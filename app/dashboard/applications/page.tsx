import type { Metadata } from "next";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { applicantCanWithdraw } from "@/lib/domain/application";
import { fileUrl } from "@/lib/services/files";
import { formatDate, formatDateTime } from "@/lib/format";
import { openApplicationChatAction, withdrawApplicationAction } from "@/lib/actions/member";
import { Button, Card, CardBody, EmptyState, PageHeader, ButtonLink } from "@/components/ui/primitives";
import { ActionForm, SubmitButton } from "@/components/ui/form";
import { StatusBadge } from "@/components/ui/status";
import { ResumeUploadForm } from "./resume-form";

export const metadata: Metadata = { title: "My applications" };

export default async function ApplicationsPage() {
  const user = await requireRolePage("WORKER");
  const [applications, resumes] = await Promise.all([
    db.jobApplication.findMany({
      where: { applicantId: user.id },
      include: { job: { include: { company: { select: { name: true } } } }, events: { orderBy: { createdAt: "desc" }, take: 1 } },
      orderBy: { updatedAt: "desc" },
    }),
    db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader title="My applications" description="Track every job you applied for." actions={<ButtonLink href="/dashboard/jobs" variant="outline">Find jobs</ButtonLink>} />
      {applications.length === 0 ? (
        <EmptyState title="No applications yet" description="When you apply to a job, its status will appear here." />
      ) : (
        <div className="space-y-3">
          {applications.map((a) => (
            <Card key={a.id}>
              <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <Link href={`/jobs/${a.jobId}`} className="font-semibold text-ink hover:text-brand">{a.job.title}</Link>
                  <p className="text-sm text-muted">{a.job.company.name} · applied {formatDate(a.createdAt)}</p>
                  {a.status === "INTERVIEW" && a.interviewAt && (
                    <p className="mt-1 text-sm font-medium text-brand">
                      Interview: {formatDateTime(a.interviewAt)}{a.interviewDetails ? ` — ${a.interviewDetails}` : ""}
                    </p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={a.status} />
                  <form action={openApplicationChatAction}>
                    <input type="hidden" name="id" value={a.id} />
                    <Button variant="ghost" size="sm"><MessageSquare className="h-4 w-4" /> Message</Button>
                  </form>
                  {applicantCanWithdraw(a.status) && (
                    <ActionForm action={withdrawApplicationAction} showSuccess={false} className="space-y-0">
                      <input type="hidden" name="id" value={a.id} />
                      <SubmitButton variant="outline" size="sm" pendingText="…">Withdraw</SubmitButton>
                    </ActionForm>
                  )}
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      <Card id="cv">
        <CardBody>
          <h2 className="font-semibold text-ink">My CVs</h2>
          <p className="mb-4 text-sm text-muted">PDF only, up to 5 MB. Shared only with employers you apply to.</p>
          {resumes.length > 0 && (
            <ul className="mb-4 divide-y divide-line rounded-lg border border-line">
              {resumes.map((r) => (
                <li key={r.id} className="flex items-center justify-between p-3 text-sm">
                  <a href={fileUrl(r.fileId)!} target="_blank" rel="noopener" className="text-brand hover:underline">{r.title}</a>
                  <span className="text-xs text-muted">{r.isDefault ? "Default · " : ""}{formatDate(r.createdAt)}</span>
                </li>
              ))}
            </ul>
          )}
          <ResumeUploadForm />
        </CardBody>
      </Card>
    </div>
  );
}
