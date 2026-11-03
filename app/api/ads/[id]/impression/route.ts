import { NextResponse, type NextRequest } from "next/server";
import { recordAdEvent } from "@/lib/services/ads";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { isSameOrigin } from "@/lib/http";

const SLOTS = ["HOME", "JOBS", "SERVICES", "WORKER_PROFILE"] as const;

export async function POST(req: NextRequest, ctx: RouteContext<"/api/ads/[id]/impression">) {
  if (!isSameOrigin(req)) return new NextResponse(null, { status: 403 });
  const { id } = await ctx.params;
  try {
    await rateLimit(`adimp:${await clientIp()}`, 120, 60);
  } catch {
    return new NextResponse(null, { status: 429 });
  }
  const slot = SLOTS.find((s) => s === req.nextUrl.searchParams.get("slot")) ?? "HOME";
  await recordAdEvent(id, "IMPRESSION", slot);
  return new NextResponse(null, { status: 204 });
}
