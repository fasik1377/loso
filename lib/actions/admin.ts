"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, type ActionResult } from "@/lib/errors";
import { assertPermission } from "@/lib/auth/guards";
import { audit } from "@/lib/audit";
import { notifyMany } from "@/lib/notifications";
import { slugify } from "@/lib/format";
import { activateUser, reviewRegistrationPayment, reviewVerification, setAccountStatus, setStaffRole } from "@/lib/services/accounts";
import { createPasswordReset } from "@/lib/services/auth";
import { createStaffJob, moderateJob } from "@/lib/services/jobs";
import { moderateReview } from "@/lib/services/service-requests";
import { createStaffAdvertisement, moderateAdvertisement } from "@/lib/services/ads";
import { moderateCompanyReview } from "@/lib/services/companies";
import { formFile, saveUpload } from "@/lib/services/files";
import { redirect } from "next/navigation";
import { hideReportedMessage, resolveReport } from "@/lib/services/moderation";
import { getSettings, settingsSchema } from "@/lib/settings";
import { appUrl } from "@/lib/config";
import { categorySchema, formToObject, jobSchema, staffAdvertisementSchema, type JobInput } from "@/lib/validation/schemas";
import { invalid, safeAction } from "./safe";

const note = (form: FormData) => String(form.get("note") ?? "").trim().slice(0, 1000) || undefined;
const id = (form: FormData) => z.string().min(1).max(40).parse(form.get("id"));

export async function reviewPaymentAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("payments.review");
    const decision = z.enum(["verify", "reject"]).parse(form.get("decision"));
    await reviewRegistrationPayment(actor, id(form), decision, note(form));
    revalidatePath("/admin/payments");
    return { ok: true, message: decision === "verify" ? "Payment verified." : "Payment rejected." };
  });
}

export async function reviewVerificationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("verifications.review");
    const decision = z.enum(["approve", "reject", "request_changes"]).parse(form.get("decision"));
    await reviewVerification(actor, id(form), decision, note(form));
    revalidatePath("/admin/verifications");
    return { ok: true, message: "Decision recorded and the applicant was notified." };
  });
}

export async function activateUserAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("verifications.review");
    await activateUser(actor, id(form), note(form));
    revalidatePath("/admin/verifications");
    revalidatePath("/admin/users");
    return { ok: true, message: "Account activated." };
  });
}

export async function accountStatusAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const action = z.enum(["suspend", "reactivate", "reject"]).parse(form.get("action"));
    const actor = await assertPermission(action === "reject" ? "verifications.review" : "users.manage");
    await setAccountStatus(actor, id(form), action, note(form));
    revalidatePath("/admin/users");
    return { ok: true, message: "Account updated." };
  });
}

export async function staffRoleAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("roles.manage");
    const role = z.enum(["ADMIN", "MODERATOR"]).parse(form.get("role"));
    await setStaffRole(actor, id(form), role, form.get("grant") === "1");
    revalidatePath("/admin/users");
    return { ok: true, message: "Roles updated." };
  });
}

export async function issueResetLinkAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("users.manage");
    const user = await db.user.findUniqueOrThrow({ where: { id: id(form) }, include: { roles: true } });
    // A reset link is an account-takeover primitive: staff accounts may only be reset by a super admin.
    if (user.roles.some((r) => r.role === "SUPER_ADMIN" || r.role === "ADMIN" || r.role === "MODERATOR") && !actor.roles.includes("SUPER_ADMIN")) {
      throw new AppError("Only a super admin can issue reset links for staff accounts.", "FORBIDDEN");
    }
    const reset = await createPasswordReset(user.phone);
    await audit({ actorId: actor.id, action: "user.reset_link_issued", entityType: "User", entityId: user.id });
    return { ok: true, message: `One-time reset link (valid 1 hour). Share it only after confirming the person's identity: ${appUrl}/reset-password?token=${reset!.token}` };
  });
}

/** Staff publish a vacancy for an employer (called from the shared React Hook Form job form). */
export async function adminSaveJobAction(input: JobInput & { publish: boolean; companyId?: string; newCompanyName?: string }): Promise<ActionResult<{ id: string }>> {
  return safeAction<{ id: string }>(async () => {
    const actor = await assertPermission("jobs.post");
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const companyId = typeof input.companyId === "string" ? input.companyId.slice(0, 40) : undefined;
    const newCompanyName = typeof input.newCompanyName === "string" ? input.newCompanyName.slice(0, 120) : undefined;
    const job = await createStaffJob(actor, parsed.data, input.publish, { companyId, newCompanyName });
    revalidatePath("/admin/jobs");
    revalidatePath("/jobs");
    return { ok: true, message: job.status === "PUBLISHED" ? "Job published." : "Draft saved.", data: { id: job.id } };
  });
}

export async function moderateJobAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("content.moderate");
    const action = z.enum(["remove", "restore", "approve", "reject", "feature", "unfeature"]).parse(form.get("action"));
    if ((action === "remove" || action === "reject") && !note(form)) throw new AppError("Give a reason so the employer knows why.");
    await moderateJob(actor, id(form), action, note(form));
    revalidatePath("/admin/jobs");
    return { ok: true, message: "Job updated." };
  });
}

export async function moderateCompanyAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("content.moderate");
    const status = z.enum(["SUSPENDED", "APPROVED"]).parse(form.get("status"));
    if (status === "SUSPENDED" && !note(form)) throw new AppError("A reason is required to suspend a company.");
    const company = await db.company.findUniqueOrThrow({ where: { id: id(form) } });
    if (status === "APPROVED" && company.status !== "SUSPENDED") throw new AppError("Use the verification queue to approve new companies.");
    await db.$transaction(async (tx) => {
      await tx.company.update({ where: { id: company.id }, data: { status, statusReason: note(form) ?? null } });
      if (status === "SUSPENDED") await tx.job.updateMany({ where: { companyId: company.id, status: "PUBLISHED" }, data: { status: "PAUSED" } });
      await audit({ actorId: actor.id, action: `company.${status.toLowerCase()}`, entityType: "Company", entityId: company.id, metadata: { note: note(form) ?? null } }, tx);
    });
    revalidatePath("/admin/jobs");
    return { ok: true, message: "Company updated." };
  });
}

export async function moderateReviewAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("content.moderate");
    await moderateReview(actor, id(form), form.get("hide") === "1", note(form));
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Review updated." };
  });
}

export async function moderateAdAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("ads.manage");
    const action = z.enum(["approve", "reject", "pause", "resume"]).parse(form.get("action"));
    await moderateAdvertisement(actor, id(form), action, note(form));
    revalidatePath("/admin/advertisements");
    return { ok: true, message: "Advertisement updated." };
  });
}

/** Admin publishes a paid advertisement (optionally a sponsored job) and records the fee charged. */
export async function createStaffAdAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("ads.manage");
    const parsed = staffAdvertisementSchema.safeParse(formToObject(form, ["slots"]));
    if (!parsed.success) return invalid(parsed.error);
    const image = formFile(form, "image");
    const imageFileId = image ? await saveUpload(image, "AD_BANNER", actor.id) : null;
    await createStaffAdvertisement(actor, parsed.data, imageFileId);
    revalidatePath("/admin/advertisements");
    revalidatePath("/");
    redirect("/admin/advertisements?created=1");
  });
}

export async function moderateCompanyReviewAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("content.moderate");
    await moderateCompanyReview(actor, id(form), form.get("hide") === "1", note(form));
    revalidatePath("/admin/reviews");
    return { ok: true, message: "Employer review updated." };
  });
}

export async function resolveReportAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("reports.handle");
    const outcome = z.enum(["RESOLVED", "DISMISSED", "IN_REVIEW"]).parse(form.get("outcome"));
    await resolveReport(actor, id(form), outcome, note(form));
    revalidatePath("/admin/reports");
    return { ok: true, message: "Report updated." };
  });
}

export async function hideMessageAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("content.moderate");
    await hideReportedMessage(actor, id(form));
    revalidatePath("/admin/reports");
    return { ok: true, message: "Message hidden." };
  });
}

export async function supportStatusAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await assertPermission("reports.handle");
    const status = z.enum(["IN_REVIEW", "RESOLVED", "DISMISSED"]).parse(form.get("status"));
    await db.supportRequest.update({ where: { id: id(form) }, data: { status } });
    revalidatePath("/admin/reports");
    return { ok: true, message: "Support request updated." };
  });
}

// ─── Taxonomy ────────────────────────────────────────────────────────────────

const taxonomyKind = z.enum(["service", "job", "skill", "location"]);

export async function saveTaxonomyAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("taxonomy.manage");
    const kind = taxonomyKind.parse(form.get("kind"));
    const parsed = categorySchema.safeParse({ name: form.get("name"), description: form.get("description") || undefined, icon: form.get("icon") || undefined, sortOrder: form.get("sortOrder") || 0 });
    if (!parsed.success) return invalid(parsed.error);
    const d = parsed.data;
    const existingId = String(form.get("id") ?? "") || null;
    const slug = slugify(d.name);
    if (!slug) return { ok: false, error: "Enter a name with letters or numbers." };
    if (kind === "service") {
      const data = { name: d.name, description: d.description ?? null, icon: d.icon ?? null, sortOrder: d.sortOrder };
      if (existingId) await db.serviceCategory.update({ where: { id: existingId }, data });
      else await db.serviceCategory.create({ data: { ...data, slug } });
    } else if (kind === "job") {
      if (existingId) await db.jobCategory.update({ where: { id: existingId }, data: { name: d.name, sortOrder: d.sortOrder } });
      else await db.jobCategory.create({ data: { name: d.name, slug, sortOrder: d.sortOrder } });
    } else if (kind === "skill") {
      if (existingId) await db.skill.update({ where: { id: existingId }, data: { name: d.name } });
      else await db.skill.create({ data: { name: d.name, slug } });
    } else {
      const parentId = String(form.get("parentId") ?? "") || null;
      const type = parentId ? "NEIGHBORHOOD" : "CITY";
      if (existingId) await db.location.update({ where: { id: existingId }, data: { name: d.name, sortOrder: d.sortOrder } });
      else await db.location.create({ data: { name: d.name, slug: parentId ? `${slug}-${parentId.slice(-4)}` : slug, type, parentId, sortOrder: d.sortOrder } });
    }
    await audit({ actorId: actor.id, action: `taxonomy.${existingId ? "update" : "create"}`, entityType: kind, entityId: existingId, metadata: { name: d.name } });
    revalidatePath("/admin/categories");
    return { ok: true, message: "Saved." };
  });
}

export async function toggleTaxonomyAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("taxonomy.manage");
    const kind = taxonomyKind.parse(form.get("kind"));
    const active = form.get("active") === "1";
    const where = { id: id(form) };
    if (kind === "service") await db.serviceCategory.update({ where, data: { active } });
    if (kind === "job") await db.jobCategory.update({ where, data: { active } });
    if (kind === "skill") await db.skill.update({ where, data: { active } });
    if (kind === "location") await db.location.update({ where, data: { active } });
    await audit({ actorId: actor.id, action: active ? "taxonomy.activate" : "taxonomy.deactivate", entityType: kind, entityId: where.id });
    revalidatePath("/admin/categories");
    return { ok: true, message: active ? "Activated." : "Deactivated." };
  });
}

// ─── Settings & announcements ────────────────────────────────────────────────

export async function saveSettingsAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("settings.manage");
    const current = await getSettings();
    const feeMajor = Number(form.get("registrationFee"));
    const candidate = {
      registrationFeeMinor: Number.isFinite(feeMajor) ? Math.round(feeMajor * 100) : NaN,
      registrationFeeCurrency: String(form.get("registrationFeeCurrency") ?? current.registrationFeeCurrency).toUpperCase(),
      manualPaymentInstructions: String(form.get("manualPaymentInstructions") ?? ""),
      requireCompanyApprovalToPublish: form.get("requireCompanyApprovalToPublish") === "on",
      requireJobReview: form.get("requireJobReview") === "on",
      maxActiveServiceRequestsPerCustomer: Number(form.get("maxActiveServiceRequestsPerCustomer")),
      supportPhone: String(form.get("supportPhone") ?? ""),
      supportEmail: String(form.get("supportEmail") ?? ""),
    };
    const parsed = settingsSchema.safeParse(candidate);
    if (!parsed.success) return invalid(parsed.error);
    const changed = Object.entries(parsed.data).filter(([k, v]) => current[k as keyof typeof current] !== v);
    await db.$transaction(async (tx) => {
      for (const [key, value] of changed) {
        await tx.platformSetting.upsert({ where: { key }, create: { key, value, updatedById: actor.id }, update: { value, updatedById: actor.id } });
      }
      await audit({ actorId: actor.id, action: "settings.update", entityType: "PlatformSetting", metadata: Object.fromEntries(changed.map(([k, v]) => [k, { from: current[k as keyof typeof current], to: v }])) }, tx);
    });
    revalidatePath("/admin/settings");
    return { ok: true, message: changed.length ? "Settings saved. The new fee applies to registrations from now on." : "No changes." };
  });
}

export async function announcementAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const actor = await assertPermission("settings.manage");
    const parsed = z.object({ title: z.string().trim().min(3).max(120), body: z.string().trim().min(3).max(1000) }).safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    const ann = await db.announcement.create({ data: { ...parsed.data, createdById: actor.id } });
    if (form.get("notifyAll") === "on") {
      const users = await db.user.findMany({ where: { status: "ACTIVE" }, select: { id: true } });
      await notifyMany(users.map((u) => u.id), { type: "ANNOUNCEMENT", title: parsed.data.title, body: parsed.data.body });
    }
    await audit({ actorId: actor.id, action: "announcement.create", entityType: "Announcement", entityId: ann.id });
    revalidatePath("/admin/settings");
    return { ok: true, message: "Announcement published." };
  });
}

export async function toggleAnnouncementAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await assertPermission("settings.manage");
    await db.announcement.update({ where: { id: id(form) }, data: { active: form.get("active") === "1" } });
    revalidatePath("/admin/settings");
    return { ok: true, message: "Updated." };
  });
}
