import type { Metadata } from "next";
import Link from "next/link";
import { Bell } from "lucide-react";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { markNotificationsReadAction } from "@/lib/actions/member";
import { formatDateTime, humanize } from "@/lib/format";
import { Button, Card, EmptyState, PageHeader, Badge } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  const user = await requireActivePage();
  const notifications = await db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 100 });
  const unread = notifications.filter((n) => !n.readAt).length;
  return (
    <div className="max-w-3xl">
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
        actions={unread ? <form action={markNotificationsReadAction}><Button variant="outline" size="sm">Mark all as read</Button></form> : undefined}
      />
      {notifications.length === 0 ? (
        <EmptyState icon={<Bell className="h-8 w-8" />} title="No notifications yet" />
      ) : (
        <Card className="divide-y divide-line">
          {notifications.map((n) => (
            <div key={n.id} className={`flex gap-3 p-4 ${n.readAt ? "" : "bg-gold-50/50"}`}>
              <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-gold"}`} aria-hidden="true" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-medium text-ink">{n.link ? <Link href={n.link} className="hover:text-brand">{n.title}</Link> : n.title}</p>
                  <Badge>{humanize(n.type)}</Badge>
                </div>
                {n.body && <p className="mt-0.5 text-sm text-muted">{n.body}</p>}
                <p className="mt-1 text-xs text-muted">{formatDateTime(n.createdAt)}</p>
              </div>
            </div>
          ))}
        </Card>
      )}
    </div>
  );
}
