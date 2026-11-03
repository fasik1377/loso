import { NextResponse, type NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getMessages } from "@/lib/services/messaging";
import { AppError } from "@/lib/errors";

/** Polled by the chat UI every few seconds (no realtime provider is configured). */
export async function GET(req: NextRequest, ctx: RouteContext<"/api/conversations/[id]/messages">) {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await ctx.params;
  const afterRaw = req.nextUrl.searchParams.get("after");
  const after = afterRaw ? new Date(afterRaw) : undefined;
  try {
    const messages = await getMessages(user.id, id, after && !Number.isNaN(after.getTime()) ? after : undefined);
    return NextResponse.json({ messages }, { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: 404 });
    throw e;
  }
}
