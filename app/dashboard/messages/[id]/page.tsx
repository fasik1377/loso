import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getMessages } from "@/lib/services/messaging";
import { Card } from "@/components/ui/primitives";
import { ChatWindow } from "./chat-window";

export const metadata: Metadata = { title: "Conversation" };

export default async function ConversationPage({ params }: PageProps<"/dashboard/messages/[id]">) {
  const user = await requireActivePage();
  const { id } = await params;
  // Membership check: non-participants get a 404 (no information leak).
  const convo = await db.conversation.findFirst({
    where: { id, participants: { some: { userId: user.id } } },
    include: {
      participants: { include: { user: { select: { id: true, fullName: true, roles: { select: { role: true } } } } } },
      serviceRequest: { select: { id: true, title: true } },
      jobApplication: { select: { id: true, jobId: true, job: { select: { title: true } } } },
    },
  });
  if (!convo) notFound();
  const messages = await getMessages(user.id, id);
  const other = convo.participants.find((p) => p.userId !== user.id)?.user;
  const isWorker = other?.roles.some((r) => r.role === "WORKER");

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/dashboard/messages" className="mb-3 inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
        <ChevronLeft className="h-4 w-4" /> All messages
      </Link>
      <Card className="flex h-[calc(100vh-11rem)] min-h-[420px] flex-col">
        <div className="border-b border-line px-4 py-3">
          <p className="font-semibold text-ink">
            {other ? (isWorker ? <Link href={`/workers/${other.id}`} className="hover:text-brand">{other.fullName}</Link> : other.fullName) : "Conversation"}
          </p>
          {convo.serviceRequest && (
            <Link href={`/dashboard/service-requests/${convo.serviceRequest.id}`} className="text-xs text-brand hover:underline">Service request: {convo.serviceRequest.title}</Link>
          )}
          {convo.jobApplication && (
            <Link href={`/jobs/${convo.jobApplication.jobId}`} className="text-xs text-brand hover:underline">Job: {convo.jobApplication.job.title}</Link>
          )}
        </div>
        <ChatWindow
          conversationId={id}
          currentUserId={user.id}
          initial={messages.map((m) => ({ id: m.id, senderId: m.senderId, body: m.body, createdAt: m.createdAt.toISOString(), hidden: !!m.hiddenAt }))}
        />
      </Card>
    </div>
  );
}
