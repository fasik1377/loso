import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare, Search } from "lucide-react";
import { requireActivePage } from "@/lib/auth/guards";
import { listConversations } from "@/lib/services/messaging";
import { str } from "@/lib/search-params";
import { timeAgo } from "@/lib/format";
import { Avatar, Card, EmptyState, PageHeader } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";

export const metadata: Metadata = { title: "Messages" };

export default async function MessagesPage({ searchParams }: PageProps<"/dashboard/messages">) {
  const user = await requireActivePage();
  const q = str(await searchParams, "q", 60);
  const conversations = await listConversations(user.id, q);
  return (
    <div className="max-w-3xl">
      <PageHeader title="Messages" description="Conversations with customers, workers and employers. New messages are checked every few seconds." />
      <form method="get" className="relative mb-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
        <label className="sr-only" htmlFor="q">Search conversations</label>
        <input id="q" name="q" defaultValue={q} placeholder="Search by name" className={`${inputClass} pl-9`} />
      </form>
      {conversations.length === 0 ? (
        <EmptyState icon={<MessageSquare className="h-8 w-8" />} title={q ? "No conversations match" : "No conversations yet"} description="Start a chat from a worker profile, a service request or a job application." />
      ) : (
        <Card className="divide-y divide-line">
          {conversations.map((c) => (
            <Link key={c.id} href={`/dashboard/messages/${c.id}`} className="flex items-center gap-3 p-4 hover:bg-canvas">
              <Avatar name={c.other?.fullName ?? "?"} size={44} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className={`truncate ${c.unread ? "font-semibold text-ink" : "font-medium text-ink"}`}>{c.other?.fullName ?? "Deleted user"}</p>
                  {c.last && <span className="shrink-0 text-xs text-muted">{timeAgo(c.last.createdAt)}</span>}
                </div>
                {c.context && <p className="truncate text-xs text-brand">{c.context}</p>}
                <p className="truncate text-sm text-muted">{c.last ? (c.last.hiddenAt ? "Message removed" : `${c.last.senderId === user.id ? "You: " : ""}${c.last.body}`) : "No messages yet"}</p>
              </div>
              {c.unread > 0 && <span className="rounded-full bg-gold px-2 text-xs font-bold text-on-gold">{c.unread}</span>}
            </Link>
          ))}
        </Card>
      )}
    </div>
  );
}
