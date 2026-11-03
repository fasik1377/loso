"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, type ActionResult } from "@/lib/errors";
import { assertActive, assertRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { formFile, saveUpload } from "@/lib/services/files";
import { createJob, getEmployerCompany, setJobStatus, updateApplicationStatus, updateJob } from "@/lib/services/jobs";
import { createAdvertisement, ownerSetAdPaused } from "@/lib/services/ads";
import { advertisementSchema, companySchema, formToObject, jobSchema, type JobInput } from "@/lib/validation/schemas";
import { invalid, safeAction } from "./safe";

export async function updateCompanyAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("EMPLOYER");
    const parsed = companySchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    const company = await db.company.findFirst({ where: { ownerId: user.id } });
    if (!company) throw new AppError("Company not found.");
    const logo = formFile(form, "logo");
    const logoFileId = logo ? await saveUpload(logo, "COMPANY_LOGO", user.id) : undefined;
    const d = parsed.data;
    await db.company.update({
      where: { id: company.id },
      data: {
        name: d.name,
        description: d.description ?? null,
        industry: d.industry ?? null,
        address: d.address ?? null,
        locationId: d.locationId ?? null,
        phone: d.phone ?? null,
        email: d.email ?? null,
        website: d.website ?? null,
        ...(logoFileId ? { logoFileId } : {}),
      },
    });
    revalidatePath("/employer/company");
    return { ok: true, message: "Company profile saved." };
  });
}

/** Job create/update is called from the React Hook Form client with a typed object. */
export async function saveJobAction(input: JobInput & { jobId?: string; publish: boolean }): Promise<ActionResult<{ id: string }>> {
  return safeAction<{ id: string }>(async () => {
    const user = await assertRole("EMPLOYER");
    await rateLimit(`job:${user.id}`, 30, 60 * 60);
    const parsed = jobSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    if (input.jobId) {
      await updateJob(user, input.jobId, parsed.data);
      if (input.publish) {
        const job = await db.job.findUniqueOrThrow({ where: { id: input.jobId } });
        if (job.status === "DRAFT") await setJobStatus(user, input.jobId, "PUBLISHED");
      }
      revalidatePath("/employer/jobs");
      return { ok: true, message: "Job saved.", data: { id: input.jobId } };
    }
    const job = await createJob(user, parsed.data, input.publish);
    revalidatePath("/employer/jobs");
    return { ok: true, message: job.status === "PUBLISHED" ? "Job published." : job.status === "PENDING_REVIEW" ? "Job submitted for review." : "Draft saved.", data: { id: job.id } };
  });
}

const jobStatusSchema = z.enum(["PUBLISHED", "PAUSED", "CLOSED", "DRAFT"]);

export async function jobStatusAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("EMPLOYER");
    const to = jobStatusSchema.parse(form.get("status"));
    const id = String(form.get("id"));
    if (to === "PUBLISHED" && form.get("deadline")) {
      const deadline = new Date(`${form.get("deadline")}T23:59:59`);
      if (Number.isNaN(deadline.getTime()) || deadline < new Date()) throw new AppError("Choose a future deadline.");
      const company = await getEmployerCompany(user.id);
      await db.job.updateMany({ where: { id, companyId: company?.id }, data: { deadline } });
    }
    await setJobStatus(user, id, to);
    revalidatePath("/employer/jobs");
    return { ok: true, message: "Job updated." };
  });
}

const appStatus = z.enum(["UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED", "REJECTED"]);

export async function applicationStatusAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("EMPLOYER");
    const to = appStatus.parse(form.get("status"));
    const interviewRaw = String(form.get("interviewAt") ?? "");
    const interviewAt = interviewRaw ? new Date(interviewRaw) : undefined;
    if (interviewAt && (Number.isNaN(interviewAt.getTime()) || interviewAt < new Date())) throw new AppError("Choose a future interview time.");
    await updateApplicationStatus(user, String(form.get("id")), to, {
      note: String(form.get("note") ?? "").slice(0, 500) || undefined,
      interviewAt,
      interviewDetails: String(form.get("interviewDetails") ?? "").slice(0, 500) || undefined,
    });
    revalidatePath("/employer/applicants");
    return { ok: true, message: "Application updated and the applicant was notified." };
  });
}

export async function saveEmployerNoteAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("EMPLOYER");
    const id = String(form.get("id"));
    const company = await getEmployerCompany(user.id);
    const res = await db.jobApplication.updateMany({
      where: { id, job: { companyId: company?.id ?? "-" } },
      data: { employerNote: String(form.get("employerNote") ?? "").slice(0, 2000) || null },
    });
    if (!res.count) throw new AppError("Application not found.");
    return { ok: true, message: "Note saved." };
  });
}

// ─── Advertisements (any active business user can submit; staff approve) ─────

export async function createAdAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await rateLimit(`ad:${user.id}`, 10, 24 * 60 * 60);
    const parsed = advertisementSchema.safeParse(formToObject(form, ["slots"]));
    if (!parsed.success) return invalid(parsed.error);
    const image = formFile(form, "image");
    const imageFileId = image ? await saveUpload(image, "AD_BANNER", user.id) : null;
    await createAdvertisement(user, parsed.data, imageFileId);
    redirect("/employer/advertisements?created=1");
  });
}

export async function toggleAdPauseAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await ownerSetAdPaused(user, String(form.get("id")), form.get("pause") === "1");
    revalidatePath("/employer/advertisements");
    return { ok: true, message: "Advertisement updated." };
  });
}
