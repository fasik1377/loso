import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { jobCompanySelect, publicJobWhere } from "@/lib/services/jobs";
import { ButtonLink, EmptyState, PageHeader } from "@/components/ui/primitives";
import { JobCard } from "@/components/marketplace/cards";

export const metadata: Metadata = { title: "Jobs for me" };

/** Jobs matching the worker's skills or areas, excluding ones already applied to. */
export default async function MyJobsPage() {
  const user = await requireRolePage("WORKER");
  const wp = await db.workerProfile.findUnique({ where: { userId: user.id }, include: { skills: true, areas: true } });
  const skillIds = wp?.skills.map((s) => s.skillId) ?? [];
  const areaIds = wp?.areas.map((a) => a.locationId) ?? [];
  const matchers = [
    ...(skillIds.length ? [{ skills: { some: { skillId: { in: skillIds } } } }] : []),
    ...(areaIds.length ? [{ locationId: { in: areaIds } }] : []),
  ];
  const jobs = await db.job.findMany({
    where: { AND: [publicJobWhere(), { applications: { none: { applicantId: user.id } } }, ...(matchers.length ? [{ OR: matchers }] : [])] },
    include: { company: { select: jobCompanySelect }, location: true },
    orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
    take: 24,
  });
  return (
    <div>
      <PageHeader
        title="Jobs for me"
        description={matchers.length ? "Open vacancies that match your skills or areas." : "Add skills and areas to your profile for better matches. Showing all open vacancies."}
        actions={<ButtonLink href="/jobs" variant="outline">Search all jobs</ButtonLink>}
      />
      {jobs.length === 0 ? (
        <EmptyState title="No matching jobs right now" description="We'll show new vacancies here as employers publish them." />
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">{jobs.map((j) => <JobCard key={j.id} job={j} />)}</div>
      )}
    </div>
  );
}
