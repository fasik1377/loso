import "server-only";
import { randomUUID } from "node:crypto";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { sanitizeDestinationUrl } from "@/lib/domain/ads";
import type { AdPlacementSlot } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { advertisementSchema, staffAdvertisementSchema } from "@/lib/validation/schemas";

type AdData = z.output<typeof advertisementSchema>;
type StaffAdData = z.output<typeof staffAdvertisementSchema>;

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

/**
 * Admin-posted paid advertisement (e.g. a sponsored job). Staff record the fee that was charged
 * and the advertiser's payment reference; the payment is stored as an ADVERTISEMENT transaction,
 * separate from worker registration fees. Published immediately (staff already reviewed it).
 */
export async function createStaffAdvertisement(actor: SessionUser, d: StaffAdData, imageFileId: string | null) {
  const destinationUrl = d.destinationUrl ? sanitizeDestinationUrl(d.destinationUrl) : null;
  if (d.destinationUrl && !destinationUrl) throw new AppError("The destination must be a valid http(s) link.");
  const job = d.jobId ? await db.job.findUnique({ where: { id: d.jobId }, include: { company: true } }) : null;
  if (d.jobId && !job) throw notFound("The selected job no longer exists.");
  if (job && job.status !== "PUBLISHED") throw conflict("Only published jobs can be sponsored.");
  if (d.charge > 0 && !d.paymentReference) throw new AppError("Enter the advertiser's payment reference for the charged fee.");
  if (d.paymentReference) {
    const dup = await db.paymentTransaction.findUnique({ where: { provider_providerReference: { provider: "manual", providerReference: d.paymentReference } } });
    if (dup) throw conflict("This payment reference has already been recorded.");
  }

  return db.$transaction(async (tx) => {
    const ad = await tx.advertisement.create({
      data: {
        // The advertiser owns the ad when it promotes their job; otherwise the staff member does.
        ownerId: job?.company.ownerId ?? actor.id,
        businessName: d.businessName || job?.company.name || "Advertiser",
        contactPhone: d.contactPhone ?? null,
        contactEmail: d.contactEmail ?? null,
        title: d.title,
        body: d.body ?? null,
        destinationUrl,
        imageFileId,
        jobId: job?.id ?? null,
        companyId: job?.companyId ?? null,
        startsAt: d.startsAt,
        endsAt: d.endsAt,
        status: "APPROVED",
        reviewedById: actor.id,
        reviewedAt: new Date(),
        postedByStaff: true,
        isPaid: d.charge > 0,
        chargeMinor: d.charge,
        placements: { create: d.slots.map((slot) => ({ slot })) },
      },
    });
    if (d.charge > 0) {
      await tx.paymentTransaction.create({
        data: {
          userId: ad.ownerId,
          purpose: "ADVERTISEMENT",
          advertisementId: ad.id,
          provider: "manual",
          method: d.paymentMethod,
          idempotencyKey: randomUUID(),
          providerReference: d.paymentReference!,
          amountMinor: d.charge,
          status: "SUCCEEDED",
          verifiedAt: new Date(),
          verifiedById: actor.id,
        },
      });
    }
    await audit({ actorId: actor.id, action: "ad.staff_create", entityType: "Advertisement", entityId: ad.id, metadata: { jobId: job?.id ?? null, chargeMinor: d.charge } }, tx);
    if (job) {
      await notify({ userId: job.company.ownerId, type: "ADVERTISEMENT", title: `Your job "${job.title}" is now sponsored on Loso`, link: `/jobs/${job.id}` }, tx);
    }
    return ad;
  });
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

/** Approved ads currently within their date window for a slot. Ads for closed jobs are skipped. */
export async function activeAdsFor(slot: AdPlacementSlot, take = 2) {
  const now = new Date();
  const ads = await db.advertisement.findMany({
    where: { status: "APPROVED", startsAt: { lte: now }, endsAt: { gte: now }, placements: { some: { slot } } },
    select: {
      id: true,
      title: true,
      body: true,
      businessName: true,
      imageFileId: true,
      destinationUrl: true,
      job: { select: { id: true, title: true, status: true, employmentType: true, salaryMinMinor: true, salaryMaxMinor: true, salaryVisible: true, currency: true, location: { select: { name: true } }, company: { select: { name: true, logoFileId: true } } } },
    },
    orderBy: { startsAt: "desc" },
    take: take * 2,
  });
  return ads.filter((a) => !a.job || a.job.status === "PUBLISHED").slice(0, take);
}

export type ActiveAd = Awaited<ReturnType<typeof activeAdsFor>>[number];

export async function recordAdEvent(adId: string, type: "IMPRESSION" | "CLICK", slot: AdPlacementSlot) {
  const ad = await db.advertisement.findUnique({ where: { id: adId }, select: { status: true, destinationUrl: true, jobId: true } });
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
