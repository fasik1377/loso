import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { requireActivePage } from "@/lib/auth/guards";
import { isStaff } from "@/lib/domain/permissions";
import { db } from "@/lib/db";
import { unreadMessageCount } from "@/lib/services/messaging";
import { formatDate, timeAgo } from "@/lib/format";
import { Alert, ButtonLink, Card, CardBody, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireActivePage();
  const isWorker = user.roles.includes("WORKER");
  const isCustomer = user.roles.includes("CUSTOMER");
  if (!isWorker && !isCustomer) redirect(user.roles.includes("EMPLOYER") ? "/employer/dashboard" : isStaff(user.roles) ? "/admin" : "/");

  const [messages, notifications, workerProfile, incoming, outgoing, applications] = await Promise.all([
    unreadMessageCount(user.id),
    db.notification.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 5 }),
    isWorker ? db.workerProfile.findUnique({ where: { userId: user.id }, include: { _count: { select: { services: true, areas: true, skills: true } } } }) : null,
    isWorker ? db.serviceRequest.findMany({ where: { workerId: user.id, status: { in: ["REQUESTED", "ACCEPTED", "IN_PROGRESS"] } }, orderBy: { createdAt: "desc" }, take: 5, include: { customer: { select: { fullName: true } } } }) : [],
    isCustomer ? db.serviceRequest.findMany({ where: { customerId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { worker: { select: { fullName: true } } } }) : [],
    isWorker ? db.jobApplication.findMany({ where: { applicantId: user.id }, orderBy: { updatedAt: "desc" }, take: 5, include: { job: { select: { id: true, title: true, company: { select: { name: true } } } } } }) : [],
  ]);

  const profileGaps: string[] = [];
  if (workerProfile) {
    if (!workerProfile.headline) profileGaps.push("a headline");
    if (workerProfile.offersServices && workerProfile._count.services === 0) profileGaps.push("at least one service");
    if (workerProfile._count.areas === 0) profileGaps.push("your service areas");
    if (workerProfile._count.skills === 0) profileGaps.push("your skills");
  }

  return (
    <div className="space-y-6">
      <PageHeader title={`Welcome, ${user.fullName.split(" ")[0]}`} description={isWorker ? "Manage your work, applications and service requests." : "Find trusted workers and track your requests."} />
      {profileGaps.length > 0 && (
        <Alert tone="warning" title="Complete your profile">
          Customers and employers find complete profiles more easily. Add {profileGaps.join(", ")}. <Link href="/dashboard/profile" className="underline">Edit profile</Link>
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Unread messages" value={messages} />
        {isWorker && <Stat label="Open service requests" value={incoming.length} />}
        {isWorker && <Stat label="Rating" value={workerProfile?.ratingAverage ? Number(workerProfile.ratingAverage).toFixed(1) : "—"} hint={`${workerProfile?.ratingCount ?? 0} reviews`} />}
        {isWorker && <Stat label="Completed services" value={workerProfile?.completedCount ?? 0} />}
        {isCustomer && <Stat label="My requests" value={outgoing.length} />}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {isWorker && (
          <Card>
            <CardBody>
              <SectionTitle title="Incoming service requests" href="/dashboard/service-requests" />
              {incoming.length === 0 ? (
                <EmptyState title="No open requests" description={workerProfile?.offersServices ? "New customer requests will appear here." : "Turn on “Offer services” in your profile to receive requests."} />
              ) : (
                <ul className="divide-y divide-line">
                  {incoming.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link href={`/dashboard/service-requests/${r.id}`} className="font-medium text-ink hover:text-brand">{r.title}</Link>
                        <p className="text-xs text-muted">{r.customer.fullName} · {timeAgo(r.createdAt)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
        {isWorker && (
          <Card>
            <CardBody>
              <SectionTitle title="Recent applications" href="/dashboard/applications" />
              {applications.length === 0 ? (
                <EmptyState title="No applications yet" action={<ButtonLink href="/dashboard/jobs" variant="outline" size="sm">Find jobs</ButtonLink>} />
              ) : (
                <ul className="divide-y divide-line">
                  {applications.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link href={`/jobs/${a.job.id}`} className="font-medium text-ink hover:text-brand">{a.job.title}</Link>
                        <p className="text-xs text-muted">{a.job.company.name} · applied {formatDate(a.createdAt)}</p>
                      </div>
                      <StatusBadge status={a.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
        {isCustomer && (
          <Card>
            <CardBody>
              <SectionTitle title="My service requests" href="/dashboard/service-requests" />
              {outgoing.length === 0 ? (
                <EmptyState title="You haven't requested a service yet" action={<ButtonLink href="/services" size="sm">Find a worker</ButtonLink>} />
              ) : (
                <ul className="divide-y divide-line">
                  {outgoing.map((r) => (
                    <li key={r.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <Link href={`/dashboard/service-requests/${r.id}`} className="font-medium text-ink hover:text-brand">{r.title}</Link>
                        <p className="text-xs text-muted">{r.worker.fullName} · {timeAgo(r.updatedAt)}</p>
                      </div>
                      <StatusBadge status={r.status} />
                    </li>
                  ))}
                </ul>
              )}
            </CardBody>
          </Card>
        )}
        <Card>
          <CardBody>
            <SectionTitle title="Latest notifications" href="/dashboard/notifications" />
            {notifications.length === 0 ? (
              <EmptyState title="No notifications yet" />
            ) : (
              <ul className="divide-y divide-line">
                {notifications.map((n) => (
                  <li key={n.id} className="py-3">
                    <p className={`text-sm ${n.readAt ? "text-muted" : "font-medium text-ink"}`}>{n.link ? <Link href={n.link} className="hover:text-brand">{n.title}</Link> : n.title}</p>
                    <p className="text-xs text-muted">{timeAgo(n.createdAt)}</p>
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
      </div>
    </div>
  );
}

function SectionTitle({ title, href }: { title: string; href: string }) {
  return (
    <div className="mb-2 flex items-center justify-between">
      <h2 className="font-semibold text-ink">{title}</h2>
      <Link href={href} className="text-sm text-brand hover:underline">View all</Link>
    </div>
  );
}
