import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getEmployerCompany } from "@/lib/services/jobs";
import { employerNextStatuses } from "@/lib/domain/application";
import type { ApplicationStatus } from "@/lib/generated/prisma";
import { fileUrl } from "@/lib/services/files";
import { str } from "@/lib/search-params";
import { formatDate, formatDateTime } from "@/lib/format";
import { openApplicationChatAction } from "@/lib/actions/member";
import { Avatar, Badge, Button, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { inputClass } from "@/components/ui/form";
import { ApplicationStatusForm, EmployerNoteForm } from "./forms";

export const metadata: Metadata = { title: "Applicants" };

const STATUSES = ["SUBMITTED", "UNDER_REVIEW", "SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED", "REJECTED", "WITHDRAWN"];

export default async function ApplicantsPage({ searchParams }: PageProps<"/employer/applicants">) {
  const user = await requireRolePage("EMPLOYER");
  const sp = await searchParams;
  const company = await getEmployerCompany(user.id);
  if (!company) return <EmptyState title="No company profile" />;
  const jobId = str(sp, "job");
  const status = STATUSES.includes(str(sp, "status") ?? "") ? str(sp, "status") : undefined;

  const [jobs, applications] = await Promise.all([
    db.job.findMany({ where: { companyId: company.id }, select: { id: true, title: true }, orderBy: { createdAt: "desc" } }),
    // Scoped to this employer's company: other companies' applicants are never queried.
    db.jobApplication.findMany({
      where: { job: { companyId: company.id }, ...(jobId ? { jobId } : {}), ...(status ? { status: status as ApplicationStatus } : {}) },
      include: {
        job: { select: { id: true, title: true } },
        resume: true,
        applicant: {
          select: {
            id: true,
            fullName: true,
            profile: { select: { avatarFileId: true } },
            workerProfile: { select: { headline: true, yearsExperience: true, offersServices: true, skills: { include: { skill: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
  ]);

  return (
    <div>
      <PageHeader title="Applicants" description="Review candidates, move them through your pipeline and message them." />
      <form method="get" className="mb-6 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Job</span>
          <select name="job" defaultValue={jobId ?? ""} className={`${inputClass} min-w-56`}>
            <option value="">All jobs</option>
            {jobs.map((j) => <option key={j.id} value={j.id}>{j.title}</option>)}
          </select>
        </label>
        <label className="text-sm">
          <span className="mb-1 block font-medium text-ink">Status</span>
          <select name="status" defaultValue={status ?? ""} className={inputClass}>
            <option value="">Any status</option>
            {STATUSES.map((s) => <option key={s} value={s}>{s.replace("_", " ").toLowerCase()}</option>)}
          </select>
        </label>
        <Button variant="outline">Filter</Button>
      </form>

      {applications.length === 0 ? (
        <EmptyState title="No applicants found" description="Applications for your jobs will appear here." />
      ) : (
        <div className="space-y-4">
          {applications.map((a) => {
            const answers = (Array.isArray(a.answers) ? a.answers : []) as { prompt: string; answer: string }[];
            const wp = a.applicant.workerProfile;
            return (
              <Card key={a.id} id={a.id}>
                <CardBody className="space-y-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex items-start gap-3">
                      <Avatar name={a.applicant.fullName} src={fileUrl(a.applicant.profile?.avatarFileId)} size={48} />
                      <div>
                        <p className="font-semibold text-ink">
                          {wp?.offersServices ? <Link href={`/workers/${a.applicant.id}`} className="hover:text-brand">{a.applicant.fullName}</Link> : a.applicant.fullName}
                        </p>
                        <p className="text-sm text-muted">{wp?.headline ?? "Job seeker"}{wp?.yearsExperience != null ? ` · ${wp.yearsExperience} yrs experience` : ""}</p>
                        <p className="text-xs text-muted">Applied to <Link href={`/jobs/${a.job.id}`} className="underline">{a.job.title}</Link> · {formatDate(a.createdAt)}</p>
                      </div>
                    </div>
                    <StatusBadge status={a.status} />
                  </div>
                  {wp?.skills.length ? <div className="flex flex-wrap gap-1">{wp.skills.map((s) => <Badge key={s.skillId} tone="brand">{s.skill.name}</Badge>)}</div> : null}
                  {a.coverLetter && (
                    <div>
                      <p className="text-xs font-semibold uppercase text-muted">Cover letter</p>
                      <p className="mt-1 whitespace-pre-line text-sm">{a.coverLetter}</p>
                    </div>
                  )}
                  {answers.length > 0 && (
                    <dl className="space-y-2 text-sm">
                      {answers.map((q, i) => (
                        <div key={i}><dt className="font-medium text-ink">{q.prompt}</dt><dd className="text-ink/80">{q.answer || "—"}</dd></div>
                      ))}
                    </dl>
                  )}
                  {a.status === "INTERVIEW" && a.interviewAt && (
                    <p className="text-sm font-medium text-brand">Interview: {formatDateTime(a.interviewAt)}{a.interviewDetails ? ` — ${a.interviewDetails}` : ""}</p>
                  )}
                  <div className="flex flex-wrap items-center gap-3 border-t border-line pt-4">
                    {a.resume ? (
                      <a href={fileUrl(a.resume.fileId)!} target="_blank" rel="noopener" className="text-sm font-semibold text-brand hover:underline">View CV (PDF)</a>
                    ) : (
                      <span className="text-sm text-muted">No CV attached</span>
                    )}
                    <form action={openApplicationChatAction}>
                      <input type="hidden" name="id" value={a.id} />
                      <Button variant="ghost" size="sm"><MessageSquare className="h-4 w-4" /> Message</Button>
                    </form>
                  </div>
                  {employerNextStatuses(a.status).length > 0 && <ApplicationStatusForm id={a.id} options={employerNextStatuses(a.status)} />}
                  <EmployerNoteForm id={a.id} note={a.employerNote ?? ""} />
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
