import type { Metadata } from "next";
import { canActivate } from "@/lib/domain/account";
import Link from "next/link";
import { requirePermissionPage } from "@/lib/auth/guards";
import { hasPermission, type Permission } from "@/lib/domain/permissions";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, humanize } from "@/lib/format";
import { activateUserAction } from "@/lib/actions/admin";
import { ButtonLink, Card, CardBody, EmptyState, PageHeader, Stat, Table } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { ActionButton, SectionTitle } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Admin overview" };

const SERVICE_STATUSES = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"] as const;

export default async function AdminOverviewPage() {
  const viewer = await requirePermissionPage("admin.access");
  const can = (p: Permission) => hasPermission(viewer.roles, p);

  const [
    usersByStatus,
    roleCounts,
    pendingPayments,
    pendingUserVerifications,
    pendingCompanyVerifications,
    openReports,
    publishedJobs,
    pendingJobs,
    requestsByStatus,
    revenue,
    pendingAds,
    candidates,
  ] = await Promise.all([
    db.user.groupBy({ by: ["status"], _count: true }),
    db.userRole.groupBy({ by: ["role"], _count: true }),
    db.registrationPayment.count({ where: { status: "UNDER_REVIEW" } }),
    db.verificationSubmission.count({ where: { status: "SUBMITTED", companyId: null } }),
    db.verificationSubmission.count({ where: { status: "SUBMITTED", companyId: { not: null } } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.job.count({ where: { status: "PUBLISHED" } }),
    db.job.count({ where: { status: "PENDING_REVIEW" } }),
    db.serviceRequest.groupBy({ by: ["status"], _count: true }),
    db.paymentTransaction.aggregate({ where: { status: "SUCCEEDED", purpose: "REGISTRATION" }, _sum: { amountMinor: true } }),
    db.advertisement.count({ where: { status: "PENDING" } }),
    // Candidates for activation (workers and employers); the exact rule (canActivate) is applied below.
    db.user.findMany({
      where: { status: "PENDING", verifications: { some: { status: "APPROVED" } } },
      select: {
        id: true,
        fullName: true,
        phone: true,
        createdAt: true,
        roles: { select: { role: true } },
        registrationPayments: { select: { status: true } },
        verifications: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, reviewedAt: true } },
      },
      orderBy: { createdAt: "asc" },
      take: 50,
    }),
  ]);

  const byStatus = (s: string) => usersByStatus.find((r) => r.status === s)?._count ?? 0;
  const byRole = (r: string) => roleCounts.find((x) => x.role === r)?._count ?? 0;
  const requests = (s: string) => requestsByStatus.find((r) => r.status === s)?._count ?? 0;
  const awaiting = candidates.filter(
    (u) =>
      canActivate({
        status: "PENDING",
        roles: u.roles.map((r) => r.role),
        payment: u.registrationPayments[0] ?? null,
        verification: u.verifications[0] ?? null,
      }).ok,
  );

  const queues: { href: string; label: string; count: number; perm: Permission }[] = [
    { href: "/admin/payments", label: "Payment reviews", count: pendingPayments, perm: "payments.review" },
    { href: "/admin/verifications?type=user", label: "Worker verifications", count: pendingUserVerifications, perm: "verifications.review" },
    { href: "/admin/verifications?type=company", label: "Company verifications", count: pendingCompanyVerifications, perm: "verifications.review" },
    { href: "/admin/jobs?status=PENDING_REVIEW", label: "Jobs awaiting review", count: pendingJobs, perm: "content.moderate" },
    { href: "/admin/reports", label: "Open reports", count: openReports, perm: "reports.handle" },
    { href: "/admin/advertisements?status=PENDING", label: "Pending ads", count: pendingAds, perm: "ads.manage" },
  ];

  return (
    <div>
      <PageHeader title="Admin overview" description="Platform health and the queues that need attention." />

      <SectionTitle title="Work queues" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {queues.filter((q) => can(q.perm)).map((q) => (
          <Link key={q.href} href={q.href} className="group rounded-xl border border-line bg-card p-4 shadow-sm transition-colors hover:border-brand">
            <p className="text-sm text-muted">{q.label}</p>
            <p className={`mt-1 text-2xl font-bold ${q.count > 0 ? "text-brand" : "text-ink"}`}>{q.count}</p>
            <p className="mt-1 text-xs font-medium text-brand group-hover:underline">Open queue →</p>
          </Link>
        ))}
      </div>

      <SectionTitle title="Users" />
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-6">
        <Stat label="Pending" value={byStatus("PENDING")} />
        <Stat label="Active" value={byStatus("ACTIVE")} />
        <Stat label="Suspended" value={byStatus("SUSPENDED")} />
        <Stat label="Workers" value={byRole("WORKER")} />
        <Stat label="Customers" value={byRole("CUSTOMER")} />
        <Stat label="Employers" value={byRole("EMPLOYER")} />
      </div>

      <SectionTitle title="Marketplace" />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published jobs" value={publishedJobs} />
        <Stat label="Completed services" value={requests("COMPLETED")} />
        <Stat label="Verified registration payments" value={formatMoney(revenue._sum.amountMinor ?? 0, "ETB")} hint="Sum of manually verified registration fees." />
        <Stat label="Pending ads" value={pendingAds} />
      </div>
      <Card className="mt-3">
        <CardBody>
          <p className="text-sm font-medium text-ink">Service requests by status</p>
          <dl className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {SERVICE_STATUSES.map((s) => (
              <div key={s}>
                <dt className="text-xs text-muted">{humanize(s)}</dt>
                <dd className="text-lg font-semibold text-ink">{requests(s)}</dd>
              </div>
            ))}
          </dl>
        </CardBody>
      </Card>

      <SectionTitle
        title="Awaiting activation"
        description="Pending workers whose registration payment is verified (or waived) AND whose latest identity verification is approved."
      />
      {awaiting.length === 0 ? (
        <EmptyState title="No accounts awaiting activation" description="Accounts appear here once both the payment and the verification checks have passed." />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>Payment</th>
              <th>Verified on</th>
              <th>Registered</th>
              <th className="sr-only">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {awaiting.map((u) => (
              <tr key={u.id}>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="font-medium text-brand hover:underline">{u.fullName}</Link>
                </td>
                <td className="whitespace-nowrap">{u.phone}</td>
                <td>{u.registrationPayments[0] && <StatusBadge status={u.registrationPayments[0].status} />}</td>
                <td className="whitespace-nowrap">{formatDate(u.verifications[0]?.reviewedAt)}</td>
                <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                <td>
                  {can("verifications.review") && u.id !== viewer.id ? (
                    <ActionButton action={activateUserAction} fields={{ id: u.id }} label="Activate" variant="primary" />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      {can("users.view") && (
        <div className="mt-4">
          <ButtonLink href="/admin/users?status=PENDING" variant="outline" size="sm">All pending users</ButtonLink>
        </div>
      )}
    </div>
  );
}
