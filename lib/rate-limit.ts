import "server-only";
import { headers } from "next/headers";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";

/**
 * Fixed-window rate limiter stored in MongoDB (works across instances without Redis).
 * One atomic findAndModify with a pipeline update: start a new window when the old one expired
 * (or the bucket doesn't exist yet), otherwise increment.
 */
export async function rateLimit(key: string, limit: number, windowSeconds: number): Promise<void> {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowSeconds * 1000);
  // A missing/null resetAt sorts before any date in BSON order, so new buckets count as expired.
  const expired = { $lt: ["$resetAt", { $date: now.toISOString() }] };
  const res = (await db.$runCommandRaw({
    findAndModify: "RateLimitBucket",
    query: { _id: key },
    update: [
      {
        $set: {
          count: { $cond: [expired, 1, { $add: ["$count", 1] }] },
          resetAt: { $cond: [expired, { $date: resetAt.toISOString() }, "$resetAt"] },
        },
      },
    ],
    upsert: true,
    new: true,
  })) as { value?: { count?: number } };
  if ((res.value?.count ?? 0) > limit) {
    throw new AppError("Too many attempts. Please wait a moment and try again.", "RATE_LIMITED");
  }
}

/** Best-effort client IP (behind a trusted proxy that sets x-forwarded-for). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "unknown";
}
