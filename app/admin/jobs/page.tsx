import type { Metadata } from "next";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { CompanyStatus, JobStatus } from "@/lib/generated/prisma";
import { buildQuery, int, str } from "@/lib/search-params";
import { formatDate, humanize } from "@/lib/format";
import { moderateCompanyAction, moderateJobAction } from "@/lib/actions/admin";
import { Badge, EmptyState, PageHeader, Pagination, Table, buttonClass } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { ActionButton, FilterField, ReasonForm, SectionTitle, adminInput } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Jobs & companies" };

const PAGE_SIZE = 25;
const JOB_STATUSES: readonly JobStatus[] = ["PENDING_REVIEW", "PUBLISHED", "DRAFT", "PAUSED", "CLOSED", "REJECTED", "REMOVED"];
const COMPANY_STATUSES: readonly CompanyStatus[] = ["PENDING_REVIEW", "APPROVED", "REJECTED", "SUSPENDED"];

export default async function AdminJobsPage({ searchParams }: PageProps<"/admin/jobs">) {
  await requirePermissionPage("content.moderate");
  const sp = await searchParams;
  const q = str(sp, "q");
  const status = JOB_STATUSES.find((s) => s === str(sp, "status"));
  const page = int(sp, "page") ?? 1;
  const cq = str(sp, "cq");
  const cstatus = COMPANY_STATUSES.find((s) => s === str(sp, "cstatus"));
  const cpage = int(sp, "cpage") ?? 1;

  const jobWhere: Prisma.JobWhereInput = {};
  if (q) jobWhere.OR = [{ title: { contains: q, mode: "insensitive" } }, { company: { name: { contains: q, mode: "insensitive" } } }];
  if (status) jobWhere.status = status;
  const companyWhere: Prisma.CompanyWhereInput = {};
  if (cq) companyWhere.name = { contains: cq, mode: "insensitive" };
  if (cstatus) companyWhere.status = cstatus;

  const [jobTotal, jobs, companyTotal, companies] = await Promise.all([
    db.job.count({ where: jobWhere }),
    db.job.findMany({
      where: jobWhere,
      include: { company: { select: { id: true, name: true, status: true } }, postedBy: { select: { id: true, fullName: true } } },
      orderBy: [{ updatedAt: "desc" }],
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.company.count({ where: companyWhere }),
    db.company.findMany({
      where: companyWhere,
      include: { owner: { select: { id: true, fullName: true } }, _count: { select: { jobs: true } } },
      orderBy: { createdAt: "desc" },
      skip: (cpage - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);
  const jobPages = Math.max(1, Math.ceil(jobTotal / PAGE_SIZE));
  const companyPages = Math.max(1, Math.ceil(companyTotal / PAGE_SIZE));

  return (
    <div>
      <PageHeader title="Jobs & companies" description="Approve, remove or feature job posts and manage employer companies." />

      <SectionTitle title={`Jobs (${jobTotal})`} />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4" aria-label="Filter jobs">
        <FilterField label="Search" className="flex-1">
          <input name="q" defaultValue={q} placeholder="Job title or company" className={adminInput} />
        </FilterField>
        <FilterField label="Status">
          <select name="status" defaultValue={status ?? ""} className={adminInput}>
            <option value="">Any status</option>
            {JOB_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        {cq && <input type="hidden" name="cq" value={cq} />}
        {cstatus && <input type="hidden" name="cstatus" value={cstatus} />}
        <button className={buttonClass("primary", "md")}>Apply</button>
      </form>

      {jobs.length === 0 ? (
        <EmptyState icon={<Briefcase className="h-8 w-8" />} title="No jobs found" />
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Job</th>
              <th>Company</th>
              <th>Status</th>
              <th>Updated</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {jobs.map((j) => (
              <tr key={j.id}>
                <td className="min-w-[14rem]">
                  <Link href={`/jobs/${j.id}`} className="font-medium text-brand hover:underline">{j.title}</Link>
                  {j.isFeatured && <Badge tone="gold" className="ml-2">Featured</Badge>}
                  <p className="text-xs text-muted">
                    Posted by <Link href={`/admin/users/${j.postedBy.id}`} className="hover:underline">{j.postedBy.fullName}</Link>
                  </p>
                  {j.moderationNote && <p className="mt-1 text-xs text-muted">Moderation note: {j.moderationNote}</p>}
                </td>
                <td>
                  <Link href={`/companies/${j.company.id}`} className="hover:underline">{j.company.name}</Link>
                  {j.company.status !== "APPROVED" && <div className="mt-1"><StatusBadge status={j.company.status} /></div>}
                </td>
                <td><StatusBadge status={j.status} /></td>
                <td className="whitespace-nowrap">{formatDate(j.updatedAt)}</td>
                <td>
                  <div className="flex flex-wrap gap-2">
                    {j.status === "PENDING_REVIEW" && (
                      <>
                        <ActionButton action={moderateJobAction} fields={{ id: j.id, action: "approve" }} label="Approve" variant="primary" />
                        <ReasonForm action={moderateJobAction} fields={{ id: j.id, action: "reject" }} label="Reject" />
                      </>
                    )}
                    {j.status === "REMOVED" ? (
                      <ActionButton action={moderateJobAction} fields={{ id: j.id, action: "restore" }} label="Restore" />
                    ) : (
                      <ReasonForm action={moderateJobAction} fields={{ id: j.id, action: "remove" }} label="Remove" />
                    )}
                    {j.isFeatured ? (
                      <ActionButton action={moderateJobAction} fields={{ id: j.id, action: "unfeature" }} label="Unfeature" />
                    ) : j.status === "PUBLISHED" ? (
                      <ActionButton action={moderateJobAction} fields={{ id: j.id, action: "feature" }} label="Feature" variant="gold" />
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={page} pages={jobPages} hrefFor={(p) => `/admin/jobs${buildQuery(sp, { page: p })}`} />

      <SectionTitle
        title={`Companies (${companyTotal})`}
        description="New companies are approved through the verification queue. Suspending a company pauses its published jobs."
      />
      <form method="get" className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-line bg-white p-4" aria-label="Filter companies">
        <FilterField label="Company name" className="flex-1">
          <input name="cq" defaultValue={cq} placeholder="Search companies" className={adminInput} />
        </FilterField>
        <FilterField label="Status">
          <select name="cstatus" defaultValue={cstatus ?? ""} className={adminInput}>
            <option value="">Any status</option>
            {COMPANY_STATUSES.map((s) => <option key={s} value={s}>{humanize(s)}</option>)}
          </select>
        </FilterField>
        {q && <input type="hidden" name="q" value={q} />}
        {status && <input type="hidden" name="status" value={status} />}
        <button className={buttonClass("primary", "md")}>Apply</button>
      </form>
      {companies.length === 0 ? (
        <p className="text-sm text-muted">No companies found.</p>
      ) : (
        <Table>
          <thead>
            <tr>
              <th>Company</th>
              <th>Owner</th>
              <th>Status</th>
              <th>Jobs</th>
              <th>Created</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {companies.map((c) => (
              <tr key={c.id}>
                <td>
                  <Link href={`/companies/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link>
                  {c.isDemo && <Badge tone="warning" className="ml-2">Demo</Badge>}
                  {c.industry && <p className="text-xs text-muted">{c.industry}</p>}
                </td>
                <td><Link href={`/admin/users/${c.owner.id}`} className="hover:underline">{c.owner.fullName}</Link></td>
                <td>
                  <StatusBadge status={c.status} />
                  {c.statusReason && <p className="mt-1 max-w-[14rem] text-xs text-muted">{c.statusReason}</p>}
                </td>
                <td>{c._count.jobs}</td>
                <td className="whitespace-nowrap">{formatDate(c.createdAt)}</td>
                <td>
                  {c.status === "SUSPENDED" ? (
                    <ActionButton action={moderateCompanyAction} fields={{ id: c.id, status: "APPROVED" }} label="Unsuspend" variant="primary" />
                  ) : c.status === "REJECTED" ? (
                    <span className="text-xs text-muted">—</span>
                  ) : (
                    <div className="space-y-1">
                      <ReasonForm action={moderateCompanyAction} fields={{ id: c.id, status: "SUSPENDED" }} label="Suspend" />
                      {c.status === "PENDING_REVIEW" && (
                        <p className="text-xs text-muted">
                          Approve via <Link href="/admin/verifications?type=company" className="text-brand hover:underline">verifications</Link>.
                        </p>
                      )}
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
      <Pagination page={cpage} pages={companyPages} hrefFor={(p) => `/admin/jobs${buildQuery(sp, { cpage: p })}`} />
    </div>
  );
}
