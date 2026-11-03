import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, conflict, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import type { SessionUser } from "@/lib/auth/session";
import type { reportSchema } from "@/lib/validation/schemas";

/** Verify the reported target exists and that the reporter could legitimately see it. */
async function assertReportable(user: SessionUser, type: z.output<typeof reportSchema>["targetType"], id: string) {
  const exists = await (async () => {
    switch (type) {
      case "USER":
        return db.user.count({ where: { id } });
      case "JOB":
        return db.job.count({ where: { id } });
      case "REVIEW":
        return db.review.count({ where: { id } });
      case "COMPANY":
        return db.company.count({ where: { id } });
      case "ADVERTISEMENT":
        return db.advertisement.count({ where: { id } });
      case "SERVICE_REQUEST":
        return db.serviceRequest.count({ where: { id, OR: [{ customerId: user.id }, { workerId: user.id }] } });
      case "MESSAGE":
        // Only a participant of the conversation can report a message.
        return db.message.count({ where: { id, conversation: { participants: { some: { userId: user.id } } } } });
    }
  })();
  if (!exists) throw notFound("The reported item could not be found.");
}

export async function createReport(user: SessionUser, d: z.output<typeof reportSchema>) {
  if (d.targetType === "USER" && d.targetId === user.id) throw new AppError("You cannot report yourself.");
  await assertReportable(user, d.targetType, d.targetId);
  const dup = await db.report.count({ where: { reporterId: user.id, targetType: d.targetType, targetId: d.targetId, status: { in: ["OPEN", "IN_REVIEW"] } } });
  if (dup) throw conflict("You have already reported this. Our team is reviewing it.");
  await db.report.create({ data: { reporterId: user.id, ...d, details: d.details ?? null } });
}

export async function resolveReport(actor: SessionUser, reportId: string, outcome: "RESOLVED" | "DISMISSED" | "IN_REVIEW", resolution?: string) {
  const report = await db.report.findUnique({ where: { id: reportId } });
  if (!report) throw notFound();
  if (outcome !== "IN_REVIEW" && !resolution) throw new AppError("Describe the outcome.");
  await db.$transaction(async (tx) => {
    await tx.report.update({
      where: { id: reportId },
      data: { status: outcome, resolution: resolution ?? null, resolvedById: outcome === "IN_REVIEW" ? null : actor.id, resolvedAt: outcome === "IN_REVIEW" ? null : new Date() },
    });
    await audit({ actorId: actor.id, action: `report.${outcome.toLowerCase()}`, entityType: "Report", entityId: reportId, metadata: { resolution: resolution ?? null } }, tx);
  });
}

/** Moderators may hide a message only when it has been reported (no browsing of private chats). */
export async function hideReportedMessage(actor: SessionUser, messageId: string) {
  const reported = await db.report.count({ where: { targetType: "MESSAGE", targetId: messageId } });
  if (!reported) throw new AppError("Only reported messages can be moderated.");
  await db.$transaction(async (tx) => {
    await tx.message.update({ where: { id: messageId }, data: { hiddenAt: new Date() } });
    await audit({ actorId: actor.id, action: "message.hide", entityType: "Message", entityId: messageId }, tx);
  });
}
