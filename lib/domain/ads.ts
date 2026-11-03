import type { AdStatus } from "@/lib/generated/prisma";

export type AdDisplayStatus = "PENDING" | "REJECTED" | "PAUSED" | "SCHEDULED" | "ACTIVE" | "EXPIRED";

/** Scheduled / Active / Expired are derived from dates so they never drift out of sync. */
export function adDisplayStatus(ad: { status: AdStatus; startsAt: Date; endsAt: Date }, now: Date = new Date()): AdDisplayStatus {
  if (ad.status !== "APPROVED") return ad.status;
  if (now < ad.startsAt) return "SCHEDULED";
  if (now > ad.endsAt) return "EXPIRED";
  return "ACTIVE";
}

/**
 * Advertisement destinations must be plain http(s) URLs. Blocks javascript:, data:, credentials
 * in the URL and other schemes that could execute code or phish.
 */
export function sanitizeDestinationUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    return null;
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password) return null;
  return url.toString();
}
