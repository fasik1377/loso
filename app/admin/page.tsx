import type { Metadata } from "next";
import type { ReactNode } from "react";
import { connection } from "next/server";
import Link from "next/link";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BadgeCheck,
  Banknote,
  Briefcase,
  Building2,
  CheckCircle2,
  ClipboardList,
  Clock,
  CreditCard,
  Flag,
  FileCheck2,
  Megaphone,
  PlusCircle,
  ShieldCheck,
  UserCheck,
  UserPlus,
  Users,
} from "lucide-react";
import { canActivate } from "@/lib/domain/account";
import { requirePermissionPage } from "@/lib/auth/guards";
import { hasPermission, type Permission } from "@/lib/domain/permissions";
import { db } from "@/lib/db";
import { formatMoney } from "@/lib/money";
import { formatDate, humanize, timeAgo } from "@/lib/format";
import { activateUserAction } from "@/lib/actions/admin";
import { Badge, ButtonLink, Card, CardBody, EmptyState, Table, cx } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { ActionButton } from "@/components/admin/action-forms";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";

export const metadata: Metadata = { title: "Admin overview" };

const SERVICE_STATUSES = ["REQUESTED", "ACCEPTED", "IN_PROGRESS", "COMPLETED", "DECLINED", "CANCELLED"] as const;
const MEMBER_ROLES = [
  { role: "WORKER", label: "Workers / job seekers" },
  { role: "CUSTOMER", label: "Customers" },
  { role: "EMPLOYER", label: "Employers" },
] as const;
const DAY_MS = 86_400_000;
const CHART_DAYS = 14;
const TZ = process.env.LOSO_TIMEZONE ?? "Africa/Addis_Ababa";

export default async function AdminOverviewPage() {
  const viewer = await requirePermissionPage("admin.access");
  await connection(); // live data: render per request
  const can = (p: Permission) => hasPermission(viewer.roles, p);

  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * DAY_MS);
  const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);
  const chartStart = new Date(now.getTime() - (CHART_DAYS - 1) * DAY_MS);
  chartStart.setUTCHours(0, 0, 0, 0);

  const [
    usersByStatus,
    roleCounts,
    totalUsers,
    newThisWeek,
    newLastWeek,
    recentSignups,
    pendingPayments,
    pendingUserVerifications,
    pendingCompanyVerifications,
    openReports,
    publishedJobs,
    jobsThisWeek,
    pendingJobs,
    requestsByStatus,
    revenue,
    pendingAds,
    approvedCompanies,
    pendingUsers,
    latestUsers,
    activity,
  ] = await Promise.all([
    db.user.groupBy({ by: ["status"], _count: true }),
    db.userRole.groupBy({ by: ["role"], _count: true }),
    db.user.count(),
    db.user.count({ where: { createdAt: { gte: weekAgo } } }),
    db.user.count({ where: { createdAt: { gte: twoWeeksAgo, lt: weekAgo } } }),
    db.user.findMany({ where: { createdAt: { gte: chartStart } }, select: { createdAt: true }, take: 10_000 }),
    db.registrationPayment.count({ where: { status: "UNDER_REVIEW" } }),
    db.verificationSubmission.count({ where: { status: "SUBMITTED", companyId: null } }),
    db.verificationSubmission.count({ where: { status: "SUBMITTED", companyId: { not: null } } }),
    db.report.count({ where: { status: { in: ["OPEN", "IN_REVIEW"] } } }),
    db.job.count({ where: { status: "PUBLISHED" } }),
    db.job.count({ where: { status: "PUBLISHED", publishedAt: { gte: weekAgo } } }),
    db.job.count({ where: { status: "PENDING_REVIEW" } }),
    db.serviceRequest.groupBy({ by: ["status"], _count: true }),
    db.paymentTransaction.aggregate({ where: { status: "SUCCEEDED", purpose: "REGISTRATION" }, _sum: { amountMinor: true } }),
    db.advertisement.count({ where: { status: "PENDING" } }),
    db.company.count({ where: { status: "APPROVED" } }),
    // Every pending account; the exact approval rule (canActivate) is applied below.
    db.user.findMany({
      where: { status: "PENDING" },
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
      take: 200,
    }),
    db.user.findMany({
      orderBy: { createdAt: "desc" },
      take: 6,
      select: { id: true, fullName: true, status: true, createdAt: true, roles: { select: { role: true } } },
    }),
    can("audit.view")
      ? db.auditLog.findMany({ orderBy: { createdAt: "desc" }, take: 8, select: { id: true, action: true, entityType: true, createdAt: true, actor: { select: { fullName: true } } } })
      : Promise.resolve([]),
  ]);

  const byStatus = (s: string) => usersByStatus.find((r) => r.status === s)?._count ?? 0;
  const byRole = (r: string) => roleCounts.find((x) => x.role === r)?._count ?? 0;
  const requests = (s: string) => requestsByStatus.find((r) => r.status === s)?._count ?? 0;

  const awaiting = pendingUsers.filter(
    (u) =>
      canActivate({
        status: "PENDING",
        roles: u.roles.map((r) => r.role),
        payment: u.registrationPayments[0] ?? null,
        verification: u.verifications[0] ?? null,
      }).ok,
  );

  // Sign-ups per day (market time zone) for the last two weeks.
  const dayKey = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  const dayLabel = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, day: "numeric", month: "short" });
  const counts = new Map<string, number>();
  for (const u of recentSignups) counts.set(dayKey.format(u.createdAt), (counts.get(dayKey.format(u.createdAt)) ?? 0) + 1);
  const days = Array.from({ length: CHART_DAYS }, (_, i) => {
    const d = new Date(now.getTime() - (CHART_DAYS - 1 - i) * DAY_MS);
    return { key: dayKey.format(d), label: dayLabel.format(d), value: counts.get(dayKey.format(d)) ?? 0 };
  });

  const queues: { href: string; label: string; count: number; perm: Permission; icon: ReactNode }[] = [
    { href: "#awaiting-approval", label: "Accounts awaiting approval", count: awaiting.length, perm: "verifications.review", icon: <UserCheck className="h-5 w-5" /> },
    { href: "/admin/payments", label: "Payment reviews", count: pendingPayments, perm: "payments.review", icon: <CreditCard className="h-5 w-5" /> },
    { href: "/admin/verifications?type=user", label: "Identity verifications", count: pendingUserVerifications, perm: "verifications.review", icon: <FileCheck2 className="h-5 w-5" /> },
    { href: "/admin/verifications?type=company", label: "Company verifications", count: pendingCompanyVerifications, perm: "verifications.review", icon: <Building2 className="h-5 w-5" /> },
    { href: "/admin/jobs?status=PENDING_REVIEW", label: "Jobs awaiting review", count: pendingJobs, perm: "content.moderate", icon: <Briefcase className="h-5 w-5" /> },
    { href: "/admin/reports", label: "Open reports", count: openReports, perm: "reports.handle", icon: <Flag className="h-5 w-5" /> },
    { href: "/admin/advertisements?status=PENDING", label: "Pending ads", count: pendingAds, perm: "ads.manage", icon: <Megaphone className="h-5 w-5" /> },
  ];
  const visibleQueues = queues.filter((q) => can(q.perm));
  const attention = visibleQueues.reduce((n, q) => n + q.count, 0);

  const quickActions = [
    { href: "/admin/jobs/new", label: "Post a job", perm: "jobs.post" as Permission, icon: <PlusCircle className="h-4 w-4" /> },
    { href: "/admin/advertisements", label: "Create an ad", perm: "ads.manage" as Permission, icon: <Megaphone className="h-4 w-4" /> },
    { href: "/admin/users?status=PENDING", label: "Pending users", perm: "users.view" as Permission, icon: <Users className="h-4 w-4" /> },
    { href: "/admin/settings", label: "Settings", perm: "settings.manage" as Permission, icon: <ShieldCheck className="h-4 w-4" /> },
  ].filter((a) => can(a.perm));

  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: TZ, hour: "numeric", hourCycle: "h23" }).format(now));
  const greeting = hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
  const firstName = viewer.fullName.split(" ")[0] ?? viewer.fullName;
  const today = new Intl.DateTimeFormat("en-GB", { timeZone: TZ, weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(now);
  const memberTotal = MEMBER_ROLES.reduce((n, r) => n + byRole(r.role), 0);
  const requestTotal = SERVICE_STATUSES.reduce((n, s) => n + requests(s), 0);

  return (
    <div className="space-y-8">
      {/* Welcome banner */}
      <section className="relative overflow-hidden rounded-3xl bg-brand-deep px-6 py-7 text-white shadow-xl shadow-brand/10 sm:px-8">
        <AnimatedBackdrop />
        <div className="relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div className="animate-fade-up">
            <p className="text-sm text-white/60">{today}</p>
            <h1 className="mt-1 text-2xl font-bold sm:text-3xl">
              {greeting}, {firstName}
            </h1>
            <p className="mt-2 flex items-center gap-2 text-white/80">
              {attention > 0 ? (
                <>
                  <span className="relative flex h-2.5 w-2.5">
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-gold opacity-75" />
                    <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-gold" />
                  </span>
                  <span>
                    <strong className="text-gold">{attention}</strong> {attention === 1 ? "item needs" : "items need"} your attention.
                  </span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 text-teal" aria-hidden="true" /> All queues are clear. Nice work!
                </>
              )}
            </p>
          </div>
          {quickActions.length > 0 && (
            <div className="flex animate-fade-up flex-wrap gap-2 [animation-delay:120ms]">
              {quickActions.map((a, i) => (
                <Link
                  key={a.href}
                  href={a.href}
                  className={cx(
                    "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-sm font-semibold transition-all hover:-translate-y-0.5",
                    i === 0 ? "bg-gold text-on-gold hover:bg-gold/90" : "bg-white/10 text-white ring-1 ring-white/20 hover:bg-white/20",
                  )}
                >
                  {a.icon} {a.label}
                </Link>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Key numbers */}
      <section aria-label="Key numbers" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Kpi
          icon={<Users className="h-5 w-5" />}
          label="Total accounts"
          value={totalUsers.toLocaleString()}
          detail={<Trend current={newThisWeek} previous={newLastWeek} suffix="new this week" />}
          delay={0}
        />
        <Kpi
          icon={<BadgeCheck className="h-5 w-5" />}
          label="Active accounts"
          value={byStatus("ACTIVE").toLocaleString()}
          detail={<span>{byStatus("PENDING")} pending · {byStatus("SUSPENDED")} suspended</span>}
          delay={80}
        />
        <Kpi
          icon={<Briefcase className="h-5 w-5" />}
          label="Published jobs"
          value={publishedJobs.toLocaleString()}
          detail={<span>+{jobsThisWeek} this week · {approvedCompanies} verified companies</span>}
          delay={160}
        />
        <Kpi
          icon={<Banknote className="h-5 w-5" />}
          label="Verified registration fees"
          value={formatMoney(revenue._sum.amountMinor ?? 0, "ETB")}
          detail={<span>{requests("COMPLETED")} services completed</span>}
          delay={240}
        />
      </section>

      {/* Work queues */}
      {visibleQueues.length > 0 && (
        <section>
          <Heading icon={<ClipboardList className="h-4 w-4" />} title="Work queues" description="Everything waiting for a staff decision." />
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {visibleQueues.map((q, i) => (
              <Link
                key={q.href}
                href={q.href}
                style={{ animationDelay: `${i * 60}ms` }}
                className={cx(
                  "group relative animate-fade-up overflow-hidden rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md",
                  q.count > 0 ? "border-gold/50" : "border-line",
                )}
              >
                {q.count > 0 && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-1 bg-gold" />}
                <div className="flex items-start justify-between gap-3">
                  <span className={cx("rounded-xl p-2.5", q.count > 0 ? "bg-gold-50 text-gold-600" : "bg-brand-50 text-brand")} aria-hidden="true">
                    {q.icon}
                  </span>
                  {q.count > 0 ? <Badge tone="warning">Needs action</Badge> : <Badge tone="success">Clear</Badge>}
                </div>
                <p className="mt-3 text-3xl font-bold text-ink">{q.count}</p>
                <p className="text-sm text-muted">{q.label}</p>
                <p className="mt-2 inline-flex items-center gap-1 text-xs font-semibold text-brand">
                  Open <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" aria-hidden="true" />
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Charts */}
      <section className="grid gap-4 lg:grid-cols-[1.6fr_1fr]">
        <Card>
          <CardBody>
            <ChartHeader title="New sign-ups" subtitle={`Accounts created per day · last ${CHART_DAYS} days`} total={days.reduce((n, d) => n + d.value, 0)} />
            <DailyBars days={days} />
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <ChartHeader title="Members by role" subtitle="An account can hold more than one role" total={memberTotal} />
            <HBars rows={MEMBER_ROLES.map((r) => ({ label: r.label, value: byRole(r.role) }))} />
            <div className="mt-6 grid grid-cols-3 gap-2 border-t border-line pt-4 text-center">
              <MiniStat label="Pending" value={byStatus("PENDING")} icon={<Clock className="h-3.5 w-3.5" />} />
              <MiniStat label="Active" value={byStatus("ACTIVE")} icon={<CheckCircle2 className="h-3.5 w-3.5" />} />
              <MiniStat label="Suspended" value={byStatus("SUSPENDED")} icon={<Flag className="h-3.5 w-3.5" />} />
            </div>
          </CardBody>
        </Card>
      </section>

      {/* Awaiting approval */}
      <section id="awaiting-approval" className="scroll-mt-20">
        <Heading
          icon={<UserCheck className="h-4 w-4" />}
          title="Awaiting approval"
          description="Every new account needs an administrator's approval. Listed here once its required checks pass (workers: verified payment + documents; employers: documents; customers: none)."
        />
        {awaiting.length === 0 ? (
          <EmptyState title="No accounts awaiting approval" description="New accounts appear here as soon as they are ready to be approved." />
        ) : (
          <Table>
            <thead>
              <tr>
                <th>Name</th>
                <th>Account type</th>
                <th>Phone</th>
                <th>Payment</th>
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
                  <td>
                    <div className="flex flex-wrap gap-1">
                      {u.roles.map((r) => <Badge key={r.role}>{humanize(r.role)}</Badge>)}
                    </div>
                  </td>
                  <td className="whitespace-nowrap">{u.phone}</td>
                  <td>{u.registrationPayments[0] ? <StatusBadge status={u.registrationPayments[0].status} /> : <span className="text-xs text-muted">No fee</span>}</td>
                  <td className="whitespace-nowrap">{formatDate(u.createdAt)}</td>
                  <td>
                    {can("verifications.review") && u.id !== viewer.id ? (
                      <ActionButton action={activateUserAction} fields={{ id: u.id }} label="Approve" variant="primary" />
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </Table>
        )}
        {can("users.view") && (
          <div className="mt-3">
            <ButtonLink href="/admin/users?status=PENDING" variant="outline" size="sm">
              All pending users ({byStatus("PENDING")})
            </ButtonLink>
          </div>
        )}
      </section>

      {/* Marketplace + people + activity */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardBody>
            <ChartHeader title="Service requests" subtitle="By current status" total={requestTotal} />
            <HBars rows={SERVICE_STATUSES.map((s) => ({ label: humanize(s), value: requests(s) }))} />
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <PanelTitle icon={<UserPlus className="h-4 w-4" />} title="Latest registrations" href={can("users.view") ? "/admin/users" : undefined} />
            {latestUsers.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No accounts yet.</p>
            ) : (
              <ul className="mt-3 divide-y divide-line">
                {latestUsers.map((u) => (
                  <li key={u.id} className="flex items-center gap-3 py-2.5">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-50 text-xs font-bold text-brand" aria-hidden="true">
                      {u.fullName.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      {can("users.view") ? (
                        <Link href={`/admin/users/${u.id}`} className="block truncate text-sm font-medium text-ink hover:text-brand">{u.fullName}</Link>
                      ) : (
                        <p className="truncate text-sm font-medium text-ink">{u.fullName}</p>
                      )}
                      <p className="truncate text-xs text-muted">
                        {u.roles.map((r) => humanize(r.role)).join(", ")} · {timeAgo(u.createdAt, now)}
                      </p>
                    </div>
                    <StatusBadge status={u.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>

        <Card>
          <CardBody>
            <PanelTitle icon={<Activity className="h-4 w-4" />} title="Recent staff & system activity" href={can("audit.view") ? "/admin/audit-logs" : undefined} />
            {!can("audit.view") ? (
              <p className="mt-4 text-sm text-muted">Your role does not include the audit log.</p>
            ) : activity.length === 0 ? (
              <p className="mt-4 text-sm text-muted">No activity recorded yet.</p>
            ) : (
              <ol className="relative mt-4 space-y-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-line">
                {activity.map((e) => (
                  <li key={e.id} className="relative flex gap-3 pl-5">
                    <span className="absolute left-0 top-1.5 h-[11px] w-[11px] rounded-full border-2 border-card bg-brand" aria-hidden="true" />
                    <div className="min-w-0">
                      <p className="text-sm text-ink">
                        <span className="font-medium">{e.actor?.fullName ?? "System"}</span> · {humanize(e.action.replace(/\./g, "_"))}
                      </p>
                      <p className="text-xs text-muted">
                        {e.entityType} · {timeAgo(e.createdAt, now)}
                      </p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </CardBody>
        </Card>
      </section>
    </div>
  );
}

/* ───────────── Small presentational pieces ───────────── */

function Kpi({ icon, label, value, detail, delay }: { icon: ReactNode; label: string; value: string; detail: ReactNode; delay: number }) {
  return (
    <div style={{ animationDelay: `${delay}ms` }} className="group relative animate-fade-up overflow-hidden rounded-2xl border border-line bg-card p-5 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md">
      <div aria-hidden="true" className="absolute -right-8 -top-8 h-24 w-24 rounded-full bg-brand-50 transition-transform duration-500 group-hover:scale-125" />
      <div className="relative flex items-center gap-3">
        <span className="rounded-xl bg-brand-deep p-2.5 text-gold" aria-hidden="true">{icon}</span>
        <p className="text-sm font-medium text-muted">{label}</p>
      </div>
      <p className="relative mt-4 text-3xl font-bold tracking-tight text-ink">{value}</p>
      <div className="relative mt-1 text-xs text-muted">{detail}</div>
    </div>
  );
}

function Trend({ current, previous, suffix }: { current: number; previous: number; suffix: string }) {
  const up = current >= previous;
  const Icon = up ? ArrowUpRight : ArrowDownRight;
  const pct = previous === 0 ? null : Math.round(((current - previous) / previous) * 100);
  return (
    <span className="inline-flex items-center gap-1">
      <Icon className={cx("h-3.5 w-3.5", up ? "text-success" : "text-danger")} aria-hidden="true" />
      <strong className="text-ink">+{current}</strong> {suffix}
      {pct !== null && <span>({pct >= 0 ? "+" : ""}{pct}% vs last week)</span>}
    </span>
  );
}

function Heading({ icon, title, description }: { icon: ReactNode; title: string; description?: string }) {
  return (
    <div className="mb-4">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink">
        <span className="text-gold-600" aria-hidden="true">{icon}</span> {title}
      </h2>
      {description && <p className="mt-0.5 text-sm text-muted">{description}</p>}
    </div>
  );
}

function PanelTitle({ icon, title, href }: { icon: ReactNode; title: string; href?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <h2 className="flex items-center gap-2 font-semibold text-ink">
        <span className="text-gold-600" aria-hidden="true">{icon}</span> {title}
      </h2>
      {href && (
        <Link href={href} className="text-xs font-semibold text-brand hover:underline">
          View all
        </Link>
      )}
    </div>
  );
}

function ChartHeader({ title, subtitle, total }: { title: string; subtitle: string; total: number }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div>
        <h2 className="font-semibold text-ink">{title}</h2>
        <p className="text-xs text-muted">{subtitle}</p>
      </div>
      <p className="text-right">
        <span className="block text-2xl font-bold text-ink">{total.toLocaleString()}</span>
        <span className="text-xs text-muted">total</span>
      </p>
    </div>
  );
}

function MiniStat({ label, value, icon }: { label: string; value: number; icon: ReactNode }) {
  return (
    <div>
      <p className="text-lg font-bold text-ink">{value}</p>
      <p className="inline-flex items-center gap-1 text-xs text-muted">
        <span aria-hidden="true">{icon}</span> {label}
      </p>
    </div>
  );
}

/** Single-series column chart with a hover/focus tooltip per day and a screen-reader table. */
function DailyBars({ days }: { days: { key: string; label: string; value: number }[] }) {
  const max = Math.max(1, ...days.map((d) => d.value));
  const peak = days.reduce((best, d) => (d.value > best.value ? d : best), days[0]!);
  return (
    <div className="mt-5">
      <div className="relative flex h-44 items-end gap-1.5 border-b border-line sm:gap-2">
        {/* Recessive guide lines */}
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-0 border-t border-dashed border-line" />
        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 top-1/2 border-t border-dashed border-line" />
        <span aria-hidden="true" className="absolute -top-2 right-0 bg-card pl-1 text-[10px] text-muted">{max}</span>
        {days.map((d, i) => (
          <div key={d.key} tabIndex={0} className="group relative flex h-full flex-1 items-end justify-center outline-none" aria-label={`${d.label}: ${d.value} sign-ups`}>
            <div
              className={cx(
                "w-full max-w-7 origin-bottom rounded-t transition-colors",
                d.value === 0 ? "bg-line" : "bg-brand/70 group-hover:bg-brand group-focus-visible:bg-brand",
              )}
              style={{ height: d.value === 0 ? 2 : `${(d.value / max) * 100}%`, animation: `bar-grow-y 0.7s cubic-bezier(0.2,0.8,0.2,1) ${i * 35}ms both` }}
            />
            {d.key === peak.key && d.value > 0 && (
              <span aria-hidden="true" className="absolute text-[10px] font-semibold text-ink" style={{ bottom: `calc(${(d.value / max) * 100}% + 4px)` }}>
                {d.value}
              </span>
            )}
            <span
              role="tooltip"
              className="pointer-events-none absolute -top-9 left-1/2 z-10 hidden -translate-x-1/2 whitespace-nowrap rounded-lg bg-brand-deep px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus-visible:block"
            >
              {d.label}: <strong>{d.value}</strong>
            </span>
          </div>
        ))}
      </div>
      <div aria-hidden="true" className="mt-1.5 flex justify-between text-[10px] text-muted">
        <span>{days[0]?.label}</span>
        <span>{days[Math.floor(days.length / 2)]?.label}</span>
        <span>Today</span>
      </div>
      <table className="sr-only">
        <caption>New sign-ups per day</caption>
        <tbody>
          {days.map((d) => (
            <tr key={d.key}>
              <th scope="row">{d.label}</th>
              <td>{d.value}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Single-hue horizontal bars with direct value labels. */
function HBars({ rows }: { rows: { label: string; value: number }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  return (
    <ul className="mt-5 space-y-3">
      {rows.map((r, i) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-2 text-sm">
            <span className="text-ink">{r.label}</span>
            <span className="font-semibold text-ink">{r.value.toLocaleString()}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-canvas">
            <div
              className="h-full origin-left rounded-full bg-brand/80"
              style={{ width: r.value === 0 ? 0 : `${Math.max(3, (r.value / max) * 100)}%`, animation: `bar-grow-x 0.8s cubic-bezier(0.2,0.8,0.2,1) ${i * 70}ms both` }}
            />
          </div>
        </li>
      ))}
    </ul>
  );
}
