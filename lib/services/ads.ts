import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sanitizeDestinationUrl } from "@/lib/domain/ads";
import type { AdPlacementSlot } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { advertisementSchema } from "@/lib/validation/schemas";

type AdData = z.output<typeof advertisementSchema>;

export async function createAdvertisement(user: SessionUser, d: AdData, imageFileId: string | null) {
  const destinationUrl = d.destinationUrl ? sanitizeDestinationUrl(d.destinationUrl) : null;
  if (d.destinationUrl && !destinationUrl) throw new AppError("The destination must be a valid http(s) link.");
  const ad = await db.advertisement.create({
    data: {
      ownerId: user.id,
      businessName: d.businessName,
      contactPhone: d.contactPhone ?? null,
      contactEmail: d.contactEmail ?? null,
      title: d.title,
      body: d.body ?? null,
      destinationUrl,
      imageFileId,
      startsAt: d.startsAt,
      endsAt: d.endsAt,
      placements: { create: d.slots.map((slot) => ({ slot })) },
    },
  });
  await audit({ actorId: user.id, action: "ad.create", entityType: "Advertisement", entityId: ad.id });
  return ad;
}

export async function ownerSetAdPaused(user: SessionUser, adId: string, paused: boolean) {
  const ad = await db.advertisement.findUnique({ where: { id: adId } });
  if (!ad || ad.ownerId !== user.id) throw notFound();
  if (paused ? ad.status !== "APPROVED" : ad.status !== "PAUSED") throw conflict("This advertisement cannot be changed right now.");
  await db.advertisement.update({ where: { id: adId }, data: { status: paused ? "PAUSED" : "APPROVED" } });
}

export async function moderateAdvertisement(actor: SessionUser, adId: string, action: "approve" | "reject" | "pause" | "resume", note?: string) {
  const ad = await db.advertisement.findUnique({ where: { id: adId } });
  if (!ad) throw notFound();
  if (ad.ownerId === actor.id && action === "approve") throw forbidden("You cannot approve your own advertisement.");
  if (action === "reject" && !note) throw new AppError("Give a reason for rejecting.");
  const status = { approve: "APPROVED", reject: "REJECTED", pause: "PAUSED", resume: "APPROVED" } as const;
  await db.$transaction(async (tx) => {
    await tx.advertisement.update({ where: { id: adId }, data: { status: status[action], moderationNote: note ?? null, reviewedById: actor.id, reviewedAt: new Date() } });
    await audit({ actorId: actor.id, action: `ad.${action}`, entityType: "Advertisement", entityId: adId, metadata: { note: note ?? null } }, tx);
    if (action === "approve" || action === "reject") {
      await notify({ userId: ad.ownerId, type: "ADVERTISEMENT", title: `Your advertisement was ${action === "approve" ? "approved" : "rejected"}`, body: note, link: "/employer/advertisements" }, tx);
    }
  });
}

/** Approved ads currently within their date window for a slot. */
export async function activeAdsFor(slot: AdPlacementSlot, take = 2) {
  const now = new Date();
  return db.advertisement.findMany({
    where: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now }, placements: { some: { slot } } },
    select: { id: true, title: true, body: true, businessName: true, imageFileId: true, destinationUrl: true },
    orderBy: { startsAt: "desc" },
    take,
  });
}

export async function recordAdEvent(adId: string, type: "IMPRESSION" | "CLICK", slot: AdPlacementSlot) {
  const ad = await db.advertisement.findUnique({ where: { id: adId }, select: { status: true, destinationUrl: true } });
  if (!ad || ad.status !== "APPROVED") return null;
  await db.advertisementEvent.create({ data: { advertisementId: adId, type, slot } });
  return ad;
}

export async function adStats(adIds: string[]) {
  const rows = await db.advertisementEvent.groupBy({ by: ["advertisementId", "type"], where: { advertisementId: { in: adIds } }, _count: true });
  const out: Record<string, { impressions: number; clicks: number }> = {};
  for (const id of adIds) out[id] = { impressions: 0, clicks: 0 };
  for (const r of rows) out[r.advertisementId]![r.type === "CLICK" ? "clicks" : "impressions"] = r._count;
  return out;
}
