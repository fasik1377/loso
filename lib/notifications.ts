import "server-only";
import { db, type Tx } from "@/lib/db";
import type { NotificationType } from "@/lib/generated/prisma";

/**
 * Delivery channels. In-app is always stored. External channels are pluggable: implement
 * `NotificationChannel` (e.g. an SMS gateway or SMTP) and add it to `channels` when credentials exist.
 */
export interface NotificationChannel {
  id: "email" | "sms";
  isConfigured(): boolean;
  send(to: { userId: string; phone: string; email: string | null }, n: { title: string; body?: string; link?: string }): Promise<void>;
}

const channels: NotificationChannel[] = [];

export async function notify(
  input: { userId: string; type: NotificationType; title: string; body?: string; link?: string },
  tx: Tx = db,
): Promise<void> {
  const pref = await tx.notificationPreference.findUnique({ where: { userId_type: { userId: input.userId, type: input.type } } });
  // Account and payment decisions are always delivered in-app regardless of preferences.
  const mandatory = input.type === "ACCOUNT" || input.type === "PAYMENT";
  if (mandatory || pref?.inApp !== false) {
    await tx.notification.create({ data: input });
  }
  const external = channels.filter((c) => c.isConfigured() && pref?.[c.id]);
  if (external.length) {
    const user = await tx.user.findUnique({ where: { id: input.userId }, select: { id: true, phone: true, email: true } });
    if (user) {
      for (const c of external) {
        c.send({ userId: user.id, phone: user.phone, email: user.email }, input).catch((e) =>
          console.error(`[notify:${c.id}] delivery failed`, e instanceof Error ? e.message : e),
        );
      }
    }
  }
}

export async function notifyMany(userIds: string[], n: Omit<Parameters<typeof notify>[0], "userId">, tx: Tx = db) {
  for (const userId of userIds) await notify({ ...n, userId }, tx);
}
