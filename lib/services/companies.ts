import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { averageRating, companyReviewEligibility } from "@/lib/domain/review";
import type { Prisma } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { companyReviewSchema } from "@/lib/validation/schemas";

async function recomputeCompanyRating(tx: Prisma.TransactionClient, companyId: string) {
  const reviews = await tx.companyReview.findMany({ where: { companyId, status: "VISIBLE" }, select: { rating: true } });
  await tx.company.update({ where: { id: companyId }, data: { ratingAverage: averageRating(reviews.map((r) => r.rating)), ratingCount: reviews.length } });
}

export async function createCompanyReview(user: SessionUser, d: z.output<typeof companyReviewSchema>) {
  const app = await db.jobApplication.findUnique({
    where: { id: d.applicationId },
    include: { job: { include: { company: true } }, companyReview: { select: { id: true } } },
  });
  if (!app) throw notFound();
  const ok = companyReviewEligibility(
    { applicantId: app.applicantId, status: app.status, companyOwnerId: app.job.company.ownerId, hasReview: !!app.companyReview },
    user.id,
  );
  if (!ok.ok) throw forbidden(ok.reason);
  await db.$transaction(async (tx) => {
    // applicationId is unique on CompanyReview, so a concurrent duplicate fails at the database too.
    await tx.companyReview.create({ data: { applicationId: app.id, companyId: app.job.companyId, authorId: user.id, rating: d.rating, comment: d.comment ?? null } });
    await recomputeCompanyRating(tx, app.job.companyId);
    await notify({ userId: app.job.company.ownerId, type: "REVIEW", title: `Your company received a ${d.rating}-star review`, link: `/companies/${app.job.companyId}` }, tx);
  });
}

export async function moderateCompanyReview(actor: SessionUser, reviewId: string, hide: boolean, reason?: string) {
  const review = await db.companyReview.findUnique({ where: { id: reviewId } });
  if (!review) throw notFound();
  if (hide && !reason) throw new AppError("A reason is required to hide a review.");
  await db.$transaction(async (tx) => {
    await tx.companyReview.update({
      where: { id: reviewId },
      data: hide ? { status: "HIDDEN", hiddenReason: reason, hiddenById: actor.id, hiddenAt: new Date() } : { status: "VISIBLE", hiddenReason: null, hiddenById: null, hiddenAt: null },
    });
    await recomputeCompanyRating(tx, review.companyId);
    await audit({ actorId: actor.id, action: hide ? "company_review.hide" : "company_review.restore", entityType: "CompanyReview", entityId: reviewId, metadata: { reason: reason ?? null } }, tx);
  });
}

/**
 * Spotlight: the best-rated verified workers and companies. Ranked only by real ratings
 * (minimum review count), never by demo data or paid placement.
 */
export async function topRated(limit = 6) {
  const [workers, companies] = await Promise.all([
    db.workerProfile.findMany({
      where: { offersServices: true, ratingCount: { gte: 1 }, user: { status: "ACTIVE", isDemo: false } },
      orderBy: [{ ratingAverage: "desc" }, { ratingCount: "desc" }, { completedCount: "desc" }],
      take: limit,
      include: {
        user: { select: { id: true, fullName: true, profile: { select: { avatarFileId: true } } } },
        services: { where: { active: true }, include: { category: true }, take: 1 },
      },
    }),
    db.company.findMany({
      where: { status: "APPROVED", isDemo: false, ratingCount: { gte: 1 } },
      orderBy: [{ ratingAverage: "desc" }, { ratingCount: "desc" }],
      take: limit,
      select: { id: true, name: true, industry: true, logoFileId: true, ratingAverage: true, ratingCount: true },
    }),
  ]);
  return { workers, companies };
}
