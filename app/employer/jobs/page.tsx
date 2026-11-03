import type { Metadata } from "next";
import Link from "next/link";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmployerCompany } from "@/lib/services/jobs";
import { deadlinePassed, employerCanSetJobStatus } from "@/lib/domain/application";
import { formatDate } from "@/lib/format";
import { ButtonLink, EmptyState, PageHeader, Table } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { JobStatusControls } from "./status-controls";

export const metadata: Metadata = { title: "Job posts" };

export default async function EmployerJobsPage() {
  const user = await requireRolePage("EMPLOYER");
  const company = await getEmployerCompany(user.id);
  const jobs = company
    ? await db.job.findMany({ where: { companyId: company.id }, include: { _count: { select: { applications: true } } }, orderBy: { updatedAt: "desc" } })
    : [];

  return (
    <div>
      <PageHeader title="Job posts" description="Create, publish, pause, close and renew your vacancies." actions={<ButtonLink href="/employer/jobs/new" variant="gold">Post a job</ButtonLink>} />
      {jobs.length === 0 ? (
        <EmptyState title="No jobs yet" description="Post your first vacancy to start receiving applications." action={<ButtonLink href="/employer/jobs/new">Post a job</ButtonLink>} />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Status</th>
              <th>Applicants</th>
              <th>Views</th>
              <th>Deadline</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((j) => {
              const expired = deadlinePassed(j.deadline);
              return (
                <tr key={j.id}>
                  <td>
                    <Link href={`/jobs/${j.id}`} className="font-medium text-ink hover:text-brand">{j.title}</Link>
                    {j.moderationNote && <p className="text-xs text-danger">Moderator: {j.moderationNote}</p>}
                  </td>
                  <td>
                    <StatusBadge status={j.status} />
                    {expired && j.status === "PUBLISHED" && <p className="mt-1 text-xs text-muted">Deadline passed — hidden from search</p>}
                  </td>
                  <td><Link href={`/employer/applicants?job=${j.id}`} className="text-brand hover:underline">{j._count.applications}</Link></td>
                  <td>{j.viewCount}</td>
                  <td className="whitespace-nowrap">{j.deadline ? formatDate(j.deadline) : "—"}</td>
                  <td>
                    <div className="flex flex-wrap items-start gap-2">
                      {j.status !== "REMOVED" && <ButtonLink href={`/employer/jobs/${j.id}/edit`} variant="outline" size="sm">Edit</ButtonLink>}
                      <JobStatusControls
                        id={j.id}
                        options={(["PUBLISHED", "PAUSED", "CLOSED"] as const).filter((s) => employerCanSetJobStatus(j.status, s))}
                        needsDeadline={j.status === "CLOSED" || expired}
                      />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </Table>
      )}
    </div>
  );
}
