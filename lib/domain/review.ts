import type { ServiceRequestStatus } from "@/lib/generated/prisma";

export function reviewEligibility(
  request: { customerId: string; workerId: string; status: ServiceRequestStatus; hasReview: boolean },
  actorId: string,
): { ok: true } | { ok: false; reason: string } {
  if (request.customerId !== actorId) return { ok: false, reason: "Only the customer who requested this service can review it." };
  if (request.workerId === actorId) return { ok: false, reason: "You cannot review yourself." };
  if (request.status !== "COMPLETED") return { ok: false, reason: "Only completed services can be reviewed." };
  if (request.hasReview) return { ok: false, reason: "You have already reviewed this service." };
  return { ok: true };
}

/** Average of visible ratings, rounded to 2 decimals; null when there are none. */
export function averageRating(ratings: number[]): number | null {
  if (ratings.length === 0) return null;
  return Math.round((ratings.reduce((a, b) => a + b, 0) / ratings.length) * 100) / 100;
}

/** Employer reviews: only the hired candidate of that application, once. */
export function companyReviewEligibility(
  application: { applicantId: string; status: string; companyOwnerId: string; hasReview: boolean },
  actorId: string,
): { ok: true } | { ok: false; reason: string } {
  if (application.applicantId !== actorId) return { ok: false, reason: "Only the hired candidate can review this employer." };
  if (application.companyOwnerId === actorId) return { ok: false, reason: "You cannot review your own company." };
  if (application.status !== "HIRED") return { ok: false, reason: "You can review an employer after you are hired." };
  if (application.hasReview) return { ok: false, reason: "You have already reviewed this employer for this job." };
  return { ok: true };
}
