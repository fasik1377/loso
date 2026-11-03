import "server-only";
import { db } from "@/lib/db";
import { forbidden, notFound } from "@/lib/errors";
import { notify } from "@/lib/notifications";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Conversations are created only through a legitimate relationship (service request or job
 * application) or by an active user contacting a public worker/employer profile.
 */
export async function ensureConversation(
  userIds: [string, string],
  link: { serviceRequestId?: string; jobApplicationId?: string } = {},
): Promise<string> {
  if (userIds[0] === userIds[1]) throw forbidden("You cannot message yourself.");
  if (link.serviceRequestId || link.jobApplicationId) {
    const existing = await db.conversation.findFirst({
      where: link.serviceRequestId ? { serviceRequestId: link.serviceRequestId } : { jobApplicationId: link.jobApplicationId },
    });
    if (existing) return existing.id;
  } else {
    const existing = await db.conversation.findFirst({
      where: {
        serviceRequestId: null,
        jobApplicationId: null,
        AND: userIds.map((userId) => ({ participants: { some: { userId } } })),
      },
    });
    if (existing) return existing.id;
  }
  const convo = await db.conversation.create({
    data: { ...link, participants: { create: userIds.map((userId) => ({ userId })) } },
  });
  return convo.id;
}

/** Direct contact from a profile page: only to active workers/employers. */
export async function startDirectConversation(user: SessionUser, otherUserId: string) {
  const other = await db.user.findUnique({ where: { id: otherUserId }, include: { roles: true } });
  if (!other || other.status !== "ACTIVE") throw notFound("This user is not available.");
  if (!other.roles.some((r) => r.role === "WORKER" || r.role === "EMPLOYER")) throw forbidden();
  return ensureConversation([user.id, other.id]);
}

async function assertParticipant(userId: string, conversationId: string) {
  const p = await db.conversationParticipant.findUnique({ where: { conversationId_userId: { conversationId, userId } } });
  if (!p) throw notFound("Conversation not found.");
  return p;
}

export async function listConversations(userId: string, q?: string) {
  const convos = await db.conversation.findMany({
    where: {
      participants: { some: { userId } },
      ...(q ? { participants: { some: { user: { fullName: { contains: q, mode: "insensitive" } }, userId: { not: userId } } } } : {}),
    },
    include: {
      participants: { include: { user: { select: { id: true, fullName: true } } } },
      messages: { orderBy: { createdAt: "desc" }, take: 1 },
      serviceRequest: { select: { id: true, title: true } },
      jobApplication: { select: { id: true, job: { select: { title: true } } } },
    },
    orderBy: [{ lastMessageAt: "desc" }, { createdAt: "desc" }],
    take: 50,
  });
  return Promise.all(
    convos.map(async (c) => {
      const me = c.participants.find((p) => p.userId === userId)!;
      const unread = await db.message.count({
        where: { conversationId: c.id, senderId: { not: userId }, ...(me.lastReadAt ? { createdAt: { gt: me.lastReadAt } } : {}) },
      });
      return {
        id: c.id,
        other: c.participants.find((p) => p.userId !== userId)?.user ?? null,
        last: c.messages[0] ?? null,
        context: c.serviceRequest ? `Service: ${c.serviceRequest.title}` : c.jobApplication ? `Job: ${c.jobApplication.job.title}` : null,
        unread,
      };
    }),
  );
}

export async function getMessages(userId: string, conversationId: string, after?: Date) {
  await assertParticipant(userId, conversationId);
  const messages = await db.message.findMany({
    where: { conversationId, ...(after ? { createdAt: { gt: after } } : {}) },
    orderBy: { createdAt: "asc" },
    take: 200,
    select: { id: true, senderId: true, body: true, hiddenAt: true, createdAt: true },
  });
  await db.conversationParticipant.update({
    where: { conversationId_userId: { conversationId, userId } },
    data: { lastReadAt: new Date() },
  });
  return messages.map((m) => ({ ...m, body: m.hiddenAt ? "This message was removed by a moderator." : m.body }));
}

export async function sendMessage(user: SessionUser, conversationId: string, body: string) {
  await assertParticipant(user.id, conversationId);
  const others = await db.conversationParticipant.findMany({ where: { conversationId, userId: { not: user.id } }, include: { user: { select: { status: true } } } });
  if (others.some((o) => o.user.status === "SUSPENDED")) throw forbidden("This user can no longer receive messages.");
  const now = new Date();
  const msg = await db.$transaction(async (tx) => {
    const m = await tx.message.create({ data: { conversationId, senderId: user.id, body }, select: { id: true, senderId: true, body: true, hiddenAt: true, createdAt: true } });
    await tx.conversation.update({ where: { id: conversationId }, data: { lastMessageAt: now } });
    await tx.conversationParticipant.update({ where: { conversationId_userId: { conversationId, userId: user.id } }, data: { lastReadAt: now } });
    return m;
  });
  // One notification per unread burst: only notify if the recipient has read everything before this.
  for (const o of others) {
    const pending = await db.notification.count({ where: { userId: o.userId, type: "MESSAGE", readAt: null, link: `/dashboard/messages/${conversationId}` } });
    if (!pending) await notify({ userId: o.userId, type: "MESSAGE", title: `New message from ${user.fullName}`, link: `/dashboard/messages/${conversationId}` });
  }
  return msg;
}

export async function unreadMessageCount(userId: string): Promise<number> {
  const parts = await db.conversationParticipant.findMany({ where: { userId }, select: { conversationId: true, lastReadAt: true } });
  if (parts.length === 0) return 0;
  return db.message.count({
    where: {
      senderId: { not: userId },
      OR: parts.map((p) => ({ conversationId: p.conversationId, ...(p.lastReadAt ? { createdAt: { gt: p.lastReadAt } } : {}) })),
    },
  });
}
