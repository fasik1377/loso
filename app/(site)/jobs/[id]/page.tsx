import { Suspense } from "react";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { after, connection } from "next/server";
import { Briefcase, Building2, CalendarClock, ExternalLink, Mail, MapPin, Users } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { deadlinePassed, jobAcceptsApplications } from "@/lib/domain/application";
import { formatRange } from "@/lib/money";
import { formatDate, humanize } from "@/lib/format";
import { fileUrl } from "@/lib/services/files";
import { Alert, Avatar, Badge, ButtonLink, Card, CardBody } from "@/components/ui/primitives";
import { StatusBadge, VerifiedBadge } from "@/components/ui/status";
import { ReportButton } from "@/components/marketplace/report-button";
import { ApplyForm } from "./apply-form";

export const metadata: Metadata = { title: "Job details" };

async function JobDetailPageContent({ params }: PageProps<"/jobs/[id]">) {
  await connection(); // live data: render per request
  const { id } = await params;
  const [job, user] = await Promise.all([
    db.job.findUnique({
      where: { id },
      include: {
        company: true,
        location: true,
        category: true,
        skills: { include: { skill: true } },
        questions: { orderBy: { sortOrder: "asc" } },
      },
    }),
    getCurrentUser(),
  ]);
  const isOwner = !!user && job?.company.ownerId === user.id;
  // Unpublished jobs are only visible to their owner.
  if (!job || (job.status !== "PUBLISHED" && job.status !== "CLOSED" && !isOwner)) notFound();
  if (["SUSPENDED", "REJECTED"].includes(job.company.status) && !isOwner) notFound();

  if (!isOwner && job.status === "PUBLISHED") {
    after(() => db.job.update({ where: { id: job.id }, data: { viewCount: { increment: 1 } } }).catch(() => undefined));
  }
  const accepting = jobAcceptsApplications(job);
  const isOpen = job.status === "PUBLISHED" && !deadlinePassed(job.deadline);
  const salary = job.salaryVisible ? formatRange(job.salaryMinMinor, job.salaryMaxMinor, job.currency) : null;
  const [existing, resumes] = user
    ? await Promise.all([
        db.jobApplication.findUnique({ where: { jobId_applicantId: { jobId: job.id, applicantId: user.id } } }),
        db.resume.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" } }),
      ])
    : [null, []];

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_340px]">
      <article>
        <Card>
          <CardBody>
            <div className="flex items-start gap-4">
              <Avatar name={job.company.name} src={fileUrl(job.company.logoFileId)} size={56} />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold text-ink">{job.title}</h1>
                <Link href={`/companies/${job.company.id}`} className="mt-1 inline-flex items-center gap-1 text-sm text-brand hover:underline">
                  <Building2 className="h-4 w-4" aria-hidden="true" /> {job.company.name}
                </Link>
                <div className="mt-3 flex flex-wrap gap-2">
                  {job.company.isDemo ? <Badge tone="warning">Demo listing</Badge> : job.company.status === "APPROVED" && <VerifiedBadge label="Verified employer" />}
                  {job.isFeatured && <Badge tone="gold">Featured</Badge>}
                  {job.status !== "PUBLISHED" && <StatusBadge status={job.status} />}
                </div>
              </div>
            </div>
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <Meta icon={Briefcase} label="Type" value={`${humanize(job.employmentType)} · ${humanize(job.experienceLevel)} level`} />
              <Meta icon={MapPin} label="Location" value={`${job.location?.name ?? "Hawassa"} · ${humanize(job.workplaceType)}`} />
              <Meta icon={CalendarClock} label="Deadline" value={job.deadline ? formatDate(job.deadline) : "Open until filled"} />
              <Meta icon={Users} label="Vacancies" value={String(job.vacancies)} />
            </dl>
            <p className="mt-4 text-lg font-semibold text-brand">{salary ?? "Salary not disclosed"}</p>
          </CardBody>
        </Card>

        <Card className="mt-6">
          <CardBody className="space-y-6">
            <Section title="About the job" text={job.description} />
            {job.responsibilities && <Section title="Responsibilities" text={job.responsibilities} />}
            {job.qualifications && <Section title="Qualifications" text={job.qualifications} />}
            {job.skills.length > 0 && (
              <div>
                <h2 className="font-semibold text-ink">Skills</h2>
                <div className="mt-2 flex flex-wrap gap-2">
                  {job.skills.map((s) => <Badge key={s.skillId} tone="brand">{s.skill.name}</Badge>)}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
        {user && !isOwner && (
          <div className="mt-4">
            <ReportButton targetType="JOB" targetId={job.id} label="Report this job" />
          </div>
        )}
      </article>

      <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
        <Card>
          <CardBody>
            <h2 className="font-semibold text-ink">Apply</h2>
            <div className="mt-3">
              {isOwner ? (
                <ButtonLink href={`/employer/applicants?job=${job.id}`} className="w-full">View applicants</ButtonLink>
              ) : !accepting.ok && (job.applicationMethod === "IN_APP" || !isOpen) ? (
                <Alert tone="warning">{isOpen ? accepting.reason : "This job is no longer accepting applications."}</Alert>
              ) : job.applicationMethod === "EMAIL" && job.applicationEmail ? (
                <a href={`mailto:${job.applicationEmail}?subject=${encodeURIComponent(`Application: ${job.title}`)}`} className="inline-flex items-center gap-2 text-brand underline">
                  <Mail className="h-4 w-4" /> Apply by email: {job.applicationEmail}
                </a>
              ) : job.applicationMethod === "EXTERNAL_URL" && job.applicationUrl ? (
                <a href={job.applicationUrl} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-2 text-brand underline">
                  Apply on the employer&apos;s website <ExternalLink className="h-4 w-4" />
                </a>
              ) : !user ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted">Sign in with a verified worker account to apply.</p>
                  <ButtonLink href={`/login?next=/jobs/${job.id}`} className="w-full">Sign in to apply</ButtonLink>
                  <ButtonLink href="/register" variant="outline" className="w-full">Create an account</ButtonLink>
                </div>
              ) : user.status !== "ACTIVE" ? (
                <Alert tone="warning" title="Account not active yet">
                  You can apply once your account is approved. <Link href="/account-status" className="underline">Check your status</Link>.
                </Alert>
              ) : !user.roles.includes("WORKER") ? (
                <Alert>Only job seeker accounts can apply for jobs.</Alert>
              ) : existing ? (
                <Alert tone="success" title="You applied">
                  Status: {humanize(existing.status)}. <Link href="/dashboard/applications" className="underline">View my applications</Link>
                </Alert>
              ) : (
                <ApplyForm jobId={job.id} questions={job.questions.map((q) => ({ id: q.id, prompt: q.prompt, required: q.required }))} resumes={resumes.map((r) => ({ id: r.id, title: r.title, isDefault: r.isDefault }))} />
              )}
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody>
            <h2 className="font-semibold text-ink">About {job.company.name}</h2>
            <p className="mt-2 line-clamp-5 text-sm text-muted">{job.company.description ?? "No company description yet."}</p>
            <Link href={`/companies/${job.company.id}`} className="mt-3 inline-block text-sm font-semibold text-brand hover:underline">Company profile</Link>
          </CardBody>
        </Card>
      </aside>
    </div>
  );
}

function Meta({ icon: Icon, label, value }: { icon: typeof Briefcase; label: string; value: string }) {
  return (
    <div className="flex items-start gap-2">
      <Icon className="mt-0.5 h-4 w-4 text-muted" aria-hidden="true" />
      <div>
        <dt className="text-xs text-muted">{label}</dt>
        <dd className="text-ink">{value}</dd>
      </div>
    </div>
  );
}

function Section({ title, text }: { title: string; text: string }) {
  return (
    <section>
      <h2 className="font-semibold text-ink">{title}</h2>
      {/* Rendered as text (React escapes it); line breaks preserved with CSS, no HTML injection. */}
      <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink/90">{text}</p>
    </section>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function JobDetailPage(props: PageProps<"/jobs/[id]">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <JobDetailPageContent {...props} />
    </Suspense>
  );
}
