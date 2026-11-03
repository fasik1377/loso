import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { db } from "@/lib/db";
import { unreadMessageCount } from "@/lib/services/messaging";

/** Unread badge counts for the dashboard shell (polled). */
export async function GET() {
  const user = await getCurrentUser();
  if (!user || user.status !== "ACTIVE") return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const [notifications, messages] = await Promise.all([
    db.notification.count({ where: { userId: user.id, readAt: null } }),
    unreadMessageCount(user.id),
  ]);
  return NextResponse.json({ notifications, messages }, { headers: { "Cache-Control": "no-store" } });
}
