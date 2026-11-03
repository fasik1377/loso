import type { Metadata } from "next";
import Link from "next/link";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmployerCompany } from "@/lib/services/jobs";
import { formatDate, timeAgo } from "@/lib/format";
import { Alert, ButtonLink, Card, CardBody, EmptyState, PageHeader, Stat } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";

export const metadata: Metadata = { title: "Employer dashboard" };

export default async function EmployerDashboardPage() {
  const user = await requireRolePage("EMPLOYER");
  const company = await getEmployerCompany(user.id);
  if (!company) {
    return <EmptyState title="No company profile" description="Your employer account has no company yet. Contact support." />;
  }
  const [jobsByStatus, appsByStatus, recentApps, jobs] = await Promise.all([
    db.job.groupBy({ by: ["status"], where: { companyId: company.id }, _count: true }),
    db.jobApplication.groupBy({ by: ["status"], where: { job: { companyId: company.id } }, _count: true }),
    db.jobApplication.findMany({
      where: { job: { companyId: company.id } },
      include: { applicant: { select: { fullName: true } }, job: { select: { id: true, title: true } } },
      orderBy: { createdAt: "desc" },
      take: 6,
    }),
    db.job.findMany({
      where: { companyId: company.id, status: { in: ["PUBLISHED", "PAUSED"] } },
      include: { _count: { select: { applications: true } } },
      orderBy: { publishedAt: "desc" },
      take: 6,
    }),
  ]);
  const count = (rows: { status: string; _count: number }[], ...s: string[]) => rows.filter((r) => s.includes(r.status)).reduce((a, r) => a + r._count, 0);

  return (
    <div className="space-y-6">
      <PageHeader title={company.name} description="Your recruitment at a glance." actions={<ButtonLink href="/employer/jobs/new" variant="gold">Post a job</ButtonLink>} />
      {company.status !== "APPROVED" && (
        <Alert tone={company.status === "REJECTED" || company.status === "SUSPENDED" ? "danger" : "warning"} title={`Company status: ${company.status.replace("_", " ").toLowerCase()}`}>
          {company.status === "PENDING_REVIEW"
            ? "You can prepare drafts, but publishing requires a verified company. Upload your business documents on the Company page."
            : company.statusReason ?? "Contact support for details."}{" "}
          <Link href="/employer/company" className="underline">Go to company page</Link>
        </Alert>
      )}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Published jobs" value={count(jobsByStatus, "PUBLISHED")} />
        <Stat label="Drafts & paused" value={count(jobsByStatus, "DRAFT", "PAUSED", "PENDING_REVIEW")} />
        <Stat label="Total applications" value={appsByStatus.reduce((a, r) => a + r._count, 0)} />
        <Stat label="Awaiting review" value={count(appsByStatus, "SUBMITTED")} hint={`${count(appsByStatus, "SHORTLISTED", "INTERVIEW")} shortlisted / interviewing`} />
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-ink">Active jobs</h2><Link href="/employer/jobs" className="text-sm text-brand hover:underline">Manage</Link></div>
            {jobs.length === 0 ? (
              <EmptyState title="No active jobs" action={<ButtonLink href="/employer/jobs/new" size="sm">Post a job</ButtonLink>} />
            ) : (
              <ul className="divide-y divide-line">
                {jobs.map((j) => (
                  <li key={j.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/employer/applicants?job=${j.id}`} className="font-medium text-ink hover:text-brand">{j.title}</Link>
                      <p className="text-xs text-muted">{j._count.applications} applicants · {j.viewCount} views · {j.deadline ? `closes ${formatDate(j.deadline)}` : "no deadline"}</p>
                    </div>
                    <StatusBadge status={j.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <div className="mb-2 flex items-center justify-between"><h2 className="font-semibold text-ink">Latest applicants</h2><Link href="/employer/applicants" className="text-sm text-brand hover:underline">View all</Link></div>
            {recentApps.length === 0 ? (
              <EmptyState title="No applications yet" />
            ) : (
              <ul className="divide-y divide-line">
                {recentApps.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-2 py-3 text-sm">
                    <div className="min-w-0">
                      <Link href={`/employer/applicants?job=${a.job.id}#${a.id}`} className="font-medium text-ink hover:text-brand">{a.applicant.fullName}</Link>
                      <p className="text-xs text-muted">{a.job.title} · {timeAgo(a.createdAt)}</p>
                    </div>
                    <StatusBadge status={a.status} />
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
