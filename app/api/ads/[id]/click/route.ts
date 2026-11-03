import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/services/ads";
import { sanitizeDestinationUrl } from "@/lib/domain/ads";

const SLOTS = ["HOME", "JOBS", "SERVICES", "WORKER_PROFILE"] as const;

export async function GET(req: NextRequest, ctx: RouteContext<"/api/ads/[id]/click">) {
  const { id } = await ctx.params;
  const slotParam = req.nextUrl.searchParams.get("slot");
  const slot = SLOTS.find((s) => s === slotParam) ?? "HOME";
  const ad = await recordAdEvent(id, "CLICK", slot);
  const dest = sanitizeDestinationUrl(ad?.destinationUrl);
  // Sponsored jobs open the job page on Loso; other ads go to their sanitized external link.
  return NextResponse.redirect(dest ?? new URL(ad?.jobId ? `/jobs/${ad.jobId}` : "/", req.url), 302);
}
