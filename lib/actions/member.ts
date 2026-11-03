"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "@/lib/db";
import { AppError, notFound, type ActionResult } from "@/lib/errors";
import { assertActive, assertRole } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { formFile, formFiles, saveUpload } from "@/lib/services/files";
import { updateProfile, updateWorkerProfile, upsertWorkerService, removeWorkerService } from "@/lib/services/workers";
import { applyToJob, startApplicationConversation, withdrawApplication } from "@/lib/services/jobs";
import { createReview, createServiceRequest, openServiceConversation, transitionServiceRequest } from "@/lib/services/service-requests";
import { sendMessage, startDirectConversation } from "@/lib/services/messaging";
import { createReport } from "@/lib/services/moderation";
import { createCompanyReview } from "@/lib/services/companies";
import type { ServiceRequestAction } from "@/lib/domain/service-request";
import type { NotificationType } from "@/lib/generated/prisma";
import {
  applicationSchema,
  companyReviewSchema,
  contactSchema,
  formToObject,
  profileSchema,
  reportSchema,
  reviewSchema,
  serviceRequestSchema,
  workerProfileSchema,
  workerServiceSchema,
} from "@/lib/validation/schemas";
import { invalid, safeAction } from "./safe";
import { clientIp } from "@/lib/rate-limit";
import { getCurrentUser } from "@/lib/auth/session";

// ─── Profile ─────────────────────────────────────────────────────────────────

export async function updateProfileAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    const raw = formToObject(form);
    raw.languages = String(form.get("languages") ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    const parsed = profileSchema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    if (parsed.data.email) {
      const taken = await db.user.count({ where: { email: parsed.data.email, id: { not: user.id } } });
      if (taken) return { ok: false, error: "That email is already used by another account.", fieldErrors: { email: ["Already in use"] } };
    }
    const avatar = formFile(form, "avatar");
    const avatarFileId = avatar ? await saveUpload(avatar, "AVATAR", user.id) : undefined;
    await updateProfile(user.id, parsed.data, avatarFileId);
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Profile saved." };
  });
}

export async function updateWorkerProfileAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    const parsed = workerProfileSchema.safeParse(formToObject(form, ["skillIds", "areaIds"], ["seeksJobs", "offersServices"]));
    if (!parsed.success) return invalid(parsed.error);
    await updateWorkerProfile(user.id, parsed.data);
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Work profile saved." };
  });
}

export async function upsertServiceAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    const parsed = workerServiceSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    await upsertWorkerService(user.id, parsed.data);
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Service saved." };
  });
}

export async function removeServiceAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    await removeWorkerService(user.id, String(form.get("id")));
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Service removed." };
  });
}

export async function addPortfolioAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    const title = z.string().trim().min(2).max(100).safeParse(form.get("title"));
    if (!title.success) return { ok: false, error: "Enter a title.", fieldErrors: { title: ["Required"] } };
    const image = formFile(form, "image");
    if (!image) return { ok: false, error: "Choose an image.", fieldErrors: { image: ["Required"] } };
    const wp = await db.workerProfile.findUniqueOrThrow({ where: { userId: user.id } });
    const count = await db.portfolioItem.count({ where: { workerId: wp.id } });
    if (count >= 12) throw new AppError("You can have up to 12 portfolio items.");
    const fileId = await saveUpload(image, "PORTFOLIO", user.id);
    await db.portfolioItem.create({ data: { workerId: wp.id, title: title.data, fileId, description: String(form.get("description") ?? "").slice(0, 300) || null } });
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Portfolio item added." };
  });
}

export async function removePortfolioAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    const res = await db.portfolioItem.deleteMany({ where: { id: String(form.get("id")), worker: { userId: user.id } } });
    if (!res.count) throw notFound();
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "Removed." };
  });
}

export async function uploadResumeAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertRole("WORKER");
    const file = formFile(form, "resume");
    if (!file) return { ok: false, error: "Choose a PDF file.", fieldErrors: { resume: ["Required"] } };
    const count = await db.resume.count({ where: { userId: user.id } });
    if (count >= 5) throw new AppError("You can keep up to 5 CVs. Delete one first.");
    const fileId = await saveUpload(file, "RESUME", user.id);
    const title = String(form.get("title") ?? "").trim().slice(0, 80) || file.name.slice(0, 80);
    await db.resume.create({ data: { userId: user.id, fileId, title, isDefault: count === 0 } });
    revalidatePath("/dashboard/applications");
    revalidatePath("/dashboard/profile");
    return { ok: true, message: "CV uploaded." };
  });
}

// ─── Jobs ────────────────────────────────────────────────────────────────────

export async function applyAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await rateLimit(`apply:${user.id}`, 30, 60 * 60);
    const answers: Record<string, string> = {};
    for (const [k, v] of form.entries()) if (k.startsWith("answer:") && typeof v === "string") answers[k.slice(7)] = v;
    const raw = { jobId: form.get("jobId"), resumeId: form.get("resumeId") || undefined, coverLetter: form.get("coverLetter") || undefined, answers };
    const parsed = applicationSchema.safeParse(raw);
    if (!parsed.success) return invalid(parsed.error);
    await applyToJob(user, parsed.data);
    revalidatePath(`/jobs/${parsed.data.jobId}`);
    return { ok: true, message: "Application submitted. Track it under My applications." };
  });
}

export async function withdrawApplicationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await withdrawApplication(user, String(form.get("id")));
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Application withdrawn." };
  });
}

export async function openApplicationChatAction(form: FormData): Promise<void> {
  const user = await assertActive();
  const id = await startApplicationConversation(user, String(form.get("id")));
  redirect(`/dashboard/messages/${id}`);
}

// ─── Service requests ────────────────────────────────────────────────────────

export async function createServiceRequestAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await rateLimit(`sreq:${user.id}`, 20, 60 * 60);
    const parsed = serviceRequestSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    const photos = formFiles(form, "photos").slice(0, 4);
    const fileIds: string[] = [];
    for (const p of photos) fileIds.push(await saveUpload(p, "SERVICE_REQUEST_PHOTO", user.id));
    const req = await createServiceRequest(user, parsed.data, fileIds);
    redirect(`/dashboard/service-requests/${req.id}?created=1`);
  });
}

const srActions = ["accept", "decline", "start", "markFinished", "confirmComplete", "cancel"] as const;

export async function serviceRequestTransitionAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    const action = z.enum(srActions).parse(form.get("action")) as ServiceRequestAction;
    const id = String(form.get("id"));
    const reason = String(form.get("reason") ?? "").trim().slice(0, 500) || undefined;
    await transitionServiceRequest(user, id, action, reason);
    revalidatePath(`/dashboard/service-requests/${id}`);
    revalidatePath("/dashboard/service-requests");
    return { ok: true, message: "Request updated." };
  });
}

export async function openServiceChatAction(form: FormData): Promise<void> {
  const user = await assertActive();
  const id = await openServiceConversation(user, String(form.get("id")));
  redirect(`/dashboard/messages/${id}`);
}

export async function reviewAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    const parsed = reviewSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    await createReview(user, parsed.data);
    revalidatePath(`/dashboard/service-requests/${parsed.data.serviceRequestId}`);
    return { ok: true, message: "Thank you! Your review has been published." };
  });
}

export async function companyReviewAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    const parsed = companyReviewSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    await createCompanyReview(user, parsed.data);
    revalidatePath("/dashboard/applications");
    return { ok: true, message: "Thank you! Your employer review has been published." };
  });
}

// ─── Messaging ───────────────────────────────────────────────────────────────

export async function contactUserAction(form: FormData): Promise<void> {
  const user = await assertActive();
  await rateLimit(`contact:${user.id}`, 30, 60 * 60);
  const id = await startDirectConversation(user, String(form.get("userId")));
  redirect(`/dashboard/messages/${id}`);
}

export async function sendMessageAction(conversationId: string, body: string) {
  const user = await assertActive();
  await rateLimit(`msg:${user.id}`, 60, 60);
  const text = z.string().trim().min(1).max(2000).parse(body);
  const m = await sendMessage(user, conversationId, text);
  return { ...m, createdAt: m.createdAt.toISOString(), hiddenAt: null };
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function reportAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await rateLimit(`report:${user.id}`, 10, 60 * 60);
    const parsed = reportSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    await createReport(user, parsed.data);
    return { ok: true, message: "Report sent. Our safety team will review it." };
  });
}

export async function contactSupportAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`support:${await clientIp()}`, 5, 60 * 60);
    const parsed = contactSchema.safeParse(formToObject(form));
    if (!parsed.success) return invalid(parsed.error);
    const user = await getCurrentUser();
    await db.supportRequest.create({ data: { ...parsed.data, userId: user?.id ?? null } });
    return { ok: true, message: "Thanks — your message has been received. Our team will get back to you." };
  });
}

// ─── Notifications & settings ────────────────────────────────────────────────

export async function markNotificationsReadAction(): Promise<void> {
  const user = await assertActive();
  await db.notification.updateMany({ where: { userId: user.id, readAt: null }, data: { readAt: new Date() } });
  revalidatePath("/dashboard/notifications");
}

const NOTIFICATION_TYPES: NotificationType[] = ["APPLICATION", "SERVICE_REQUEST", "MESSAGE", "REVIEW", "JOB", "ADVERTISEMENT", "ANNOUNCEMENT"];

export async function notificationPrefsAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await db.$transaction(
      NOTIFICATION_TYPES.map((type) =>
        db.notificationPreference.upsert({
          where: { userId_type: { userId: user.id, type } },
          create: { userId: user.id, type, inApp: form.get(`inApp:${type}`) === "on" },
          update: { inApp: form.get(`inApp:${type}`) === "on" },
        }),
      ),
    );
    return { ok: true, message: "Notification preferences saved." };
  });
}

export async function requestDeletionAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    if (form.get("confirm") !== "DELETE") return { ok: false, error: 'Type DELETE to confirm.', fieldErrors: { confirm: ['Type DELETE'] } };
    await db.user.update({ where: { id: user.id }, data: { deletionRequestedAt: new Date() } });
    await db.auditLog.create({ data: { actorId: user.id, action: "user.deletion_requested", entityType: "User", entityId: user.id } });
    return { ok: true, message: "Deletion request recorded. Our team will process it and contact you." };
  });
}
