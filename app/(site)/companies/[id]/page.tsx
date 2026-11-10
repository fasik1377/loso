import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Globe, MapPin } from "lucide-react";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { publicJobWhere, jobCompanySelect } from "@/lib/services/jobs";
import { fileUrl } from "@/lib/services/files";
import { Avatar, Badge, Card, CardBody, EmptyState } from "@/components/ui/primitives";
import { Rating, Stars, VerifiedBadge } from "@/components/ui/status";
import { formatDate } from "@/lib/format";
import { JobCard } from "@/components/marketplace/cards";
import { ReportButton } from "@/components/marketplace/report-button";

export const metadata: Metadata = { title: "Company" };

async function CompanyPageContent({ params }: PageProps<"/companies/[id]">) {
  await connection(); // live data: render per request
  const { id } = await params;
  const [company, viewer] = await Promise.all([db.company.findUnique({ where: { id }, include: { location: true } }), getCurrentUser()]);
  if (!company || (["SUSPENDED", "REJECTED"].includes(company.status) && company.ownerId !== viewer?.id)) notFound();
  const [jobs, reviews] = await Promise.all([
    db.job.findMany({
      where: { ...publicJobWhere(), companyId: company.id },
      include: { company: { select: jobCompanySelect }, location: true },
      orderBy: { publishedAt: "desc" },
    }),
    db.companyReview.findMany({
      where: { companyId: company.id, status: "VISIBLE" },
      include: { author: { select: { fullName: true } }, application: { select: { job: { select: { title: true } } } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
      <Card>
        <CardBody>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar name={company.name} src={fileUrl(company.logoFileId)} size={80} />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-2xl font-bold text-ink">{company.name}</h1>
                {company.isDemo ? <Badge tone="warning">Demo company</Badge> : company.status === "APPROVED" ? <VerifiedBadge label="Verified employer" /> : <Badge>Not yet verified</Badge>}
              </div>
              <div className="mt-2"><Rating average={company.ratingAverage} count={company.ratingCount} /></div>
              <div className="mt-2 flex flex-wrap gap-4 text-sm text-muted">
                {company.industry && <span>{company.industry}</span>}
                {(company.address || company.location) && (
                  <span className="inline-flex items-center gap-1"><MapPin className="h-4 w-4" /> {[company.address, company.location?.name].filter(Boolean).join(", ")}</span>
                )}
                {company.website && (
                  <a href={company.website} target="_blank" rel="noopener noreferrer nofollow" className="inline-flex items-center gap-1 text-brand hover:underline">
                    <Globe className="h-4 w-4" /> Website
                  </a>
                )}
              </div>
            </div>
          </div>
          {company.description && <p className="mt-4 whitespace-pre-line text-sm text-ink/90">{company.description}</p>}
        </CardBody>
      </Card>
      <h2 className="mb-4 mt-8 text-xl font-bold text-ink">Open positions ({jobs.length})</h2>
      {jobs.length === 0 ? (
        <EmptyState title="No open positions" description="This employer has no published vacancies right now." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
      )}
      <h2 className="mb-4 mt-10 text-xl font-bold text-ink">Reviews from employees ({company.ratingCount})</h2>
      {reviews.length === 0 ? (
        <EmptyState title="No employee reviews yet" description="Only people hired through Looso can review this employer." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {reviews.map((r) => (
            <Card key={r.id}>
              <CardBody>
                <div className="flex items-center justify-between"><Stars value={r.rating} /><span className="text-xs text-muted">{formatDate(r.createdAt)}</span></div>
                {r.comment && <p className="mt-2 text-sm text-ink/90">{r.comment}</p>}
                <p className="mt-2 text-xs text-muted">{r.author.fullName.split(" ")[0]} · hired as {r.application.job.title} · verified hire</p>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
      {viewer && viewer.id !== company.ownerId && <div className="mt-6"><ReportButton targetType="COMPANY" targetId={company.id} label="Report this company" /></div>}
    </div>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function CompanyPage(props: PageProps<"/companies/[id]">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <CompanyPageContent {...props} />
    </Suspense>
  );
}
