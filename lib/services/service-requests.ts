import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { nextServiceRequestStatus, type ServiceRequestAction } from "@/lib/domain/service-request";
import { averageRating, reviewEligibility } from "@/lib/domain/review";
import type { Prisma } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { reviewSchema, serviceRequestSchema } from "@/lib/validation/schemas";
import { audit } from "@/lib/audit";
import { ensureConversation } from "./messaging";

export async function createServiceRequest(user: SessionUser, d: z.output<typeof serviceRequestSchema>, attachmentFileIds: string[]) {
  if (d.workerId === user.id) throw forbidden("You cannot request a service from yourself.");
  const worker = await db.user.findUnique({
    where: { id: d.workerId },
    include: { workerProfile: { include: { services: { where: { categoryId: d.categoryId, active: true } } } } },
  });
  if (!worker || worker.status !== "ACTIVE" || !worker.workerProfile?.offersServices) throw notFound("This worker is not available.");
  if (worker.workerProfile.services.length === 0) throw new AppError("This worker does not offer the selected service.");
  if (worker.workerProfile.availability === "UNAVAILABLE") throw conflict("This worker is currently unavailable.");
  if (d.preferredAt && d.preferredAt < new Date()) throw new AppError("The preferred time must be in the future.");

  const settings = await getSettings();
  const open = await db.serviceRequest.count({ where: { customerId: user.id, status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] } } });
  if (open >= settings.maxActiveServiceRequestsPerCustomer) throw conflict("You have too many open requests. Complete or cancel some first.");

  return db.$transaction(async (tx) => {
    const req = await tx.serviceRequest.create({
      data: {
        customerId: user.id,
        workerId: d.workerId,
        categoryId: d.categoryId,
        title: d.title,
        description: d.description,
        preferredAt: d.preferredAt ?? null,
        locationId: d.locationId ?? null,
        addressDetail: d.addressDetail ?? null,
        budgetMinor: d.budget ?? null,
        attachments: { create: attachmentFileIds.map((fileId) => ({ fileId })) },
      },
    });
    await notify({ userId: d.workerId, type: "SERVICE_REQUEST", title: "New service request", body: d.title, link: `/dashboard/service-requests/${req.id}` }, tx);
    return req;
  });
}

export async function getServiceRequestFor(user: SessionUser, id: string) {
  const req = await db.serviceRequest.findUnique({
    where: { id },
    include: {
      customer: { select: { id: true, fullName: true, phone: true } },
      worker: { select: { id: true, fullName: true, phone: true } },
      category: true,
      location: true,
      attachments: true,
      review: true,
    },
  });
  if (!req || (req.customerId !== user.id && req.workerId !== user.id)) throw notFound("Request not found.");
  return req;
}

export async function transitionServiceRequest(user: SessionUser, id: string, action: ServiceRequestAction, reason?: string) {
  const req = await db.serviceRequest.findUnique({ where: { id } });
  if (!req) throw notFound();
  const actor = req.customerId === user.id ? "customer" : req.workerId === user.id ? "worker" : null;
  if (!actor) throw notFound();
  const result = nextServiceRequestStatus(req.status, action, actor);
  if (!result.ok) throw conflict(result.reason);
  if (action === "markFinished" && req.workerFinishedAt) throw conflict("You already reported this work as finished.");
  if ((action === "decline" || action === "cancel") && !reason) throw new AppError("Please give a short reason.");

  const now = new Date();
  const data: Prisma.ServiceRequestUpdateManyMutationInput = { status: result.to };
  if (action === "accept") data.acceptedAt = now;
  if (action === "start") data.startedAt = now;
  if (action === "markFinished") data.workerFinishedAt = now;
  if (action === "confirmComplete") data.completedAt = now;
  if (action === "decline") Object.assign(data, { declinedAt: now, declineReason: reason });
  if (action === "cancel") Object.assign(data, { cancelledAt: now, cancelledById: user.id, cancelReason: reason });

  await db.$transaction(async (tx) => {
    // Optimistic concurrency: only apply if the status hasn't changed underneath us.
    const updated = await tx.serviceRequest.updateMany({ where: { id, status: req.status }, data });
    if (updated.count !== 1) throw conflict("This request was updated by someone else. Refresh and try again.");
    if (action === "confirmComplete") {
      await tx.workerProfile.update({ where: { userId: req.workerId }, data: { completedCount: { increment: 1 } } });
    }
    const recipient = actor === "customer" ? req.workerId : req.customerId;
    const titles: Record<ServiceRequestAction, string> = {
      accept: "Your service request was accepted",
      decline: "Your service request was declined",
      start: "Work on your request has started",
      markFinished: "The worker reported the job as finished — please confirm",
      confirmComplete: "The customer confirmed the job is complete",
      cancel: "A service request was cancelled",
    };
    await notify({ userId: recipient, type: "SERVICE_REQUEST", title: titles[action], body: reason ?? req.title, link: `/dashboard/service-requests/${id}` }, tx);
  });
}

export async function openServiceConversation(user: SessionUser, id: string) {
  const req = await getServiceRequestFor(user, id);
  return ensureConversation([req.customerId, req.workerId], { serviceRequestId: req.id });
}

// ─── Reviews ─────────────────────────────────────────────────────────────────

async function recomputeRating(tx: Prisma.TransactionClient, workerUserId: string) {
  const reviews = await tx.review.findMany({ where: { subjectId: workerUserId, status: "VISIBLE" }, select: { rating: true } });
  const avg = averageRating(reviews.map((r) => r.rating));
  await tx.workerProfile.update({ where: { userId: workerUserId }, data: { ratingAverage: avg, ratingCount: reviews.length } });
}

export async function createReview(user: SessionUser, d: z.output<typeof reviewSchema>) {
  const req = await db.serviceRequest.findUnique({ where: { id: d.serviceRequestId }, include: { review: { select: { id: true } } } });
  if (!req) throw notFound();
  const eligible = reviewEligibility({ ...req, hasReview: !!req.review }, user.id);
  if (!eligible.ok) throw forbidden(eligible.reason);

  await db.$transaction(async (tx) => {
    // serviceRequestId is UNIQUE on Review, so a concurrent duplicate fails at the database too.
    await tx.review.create({
      data: { serviceRequestId: req.id, authorId: user.id, subjectId: req.workerId, rating: d.rating, comment: d.comment ?? null },
    });
    await recomputeRating(tx, req.workerId);
    await notify({ userId: req.workerId, type: "REVIEW", title: `You received a ${d.rating}-star review`, link: "/dashboard/reviews" }, tx);
  });
}

export async function moderateReview(actor: SessionUser, reviewId: string, hide: boolean, reason?: string) {
  const review = await db.review.findUnique({ where: { id: reviewId } });
  if (!review) throw notFound();
  if (hide && !reason) throw new AppError("A reason is required to hide a review.");
  await db.$transaction(async (tx) => {
    await tx.review.update({
      where: { id: reviewId },
      data: hide
        ? { status: "HIDDEN", hiddenReason: reason, hiddenById: actor.id, hiddenAt: new Date() }
        : { status: "VISIBLE", hiddenReason: null, hiddenById: null, hiddenAt: null },
    });
    await recomputeRating(tx, review.subjectId);
    await audit({ actorId: actor.id, action: hide ? "review.hide" : "review.restore", entityType: "Review", entityId: reviewId, metadata: { reason: reason ?? null } }, tx);
  });
}
