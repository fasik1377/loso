import type { Metadata } from "next";
import { Suspense, type ReactNode } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import Link from "next/link";
import { Briefcase } from "lucide-react";
import { searchJobs } from "@/lib/services/jobs";
import { areaLocations, jobCategories } from "@/lib/services/taxonomy";
import { buildQuery, int, str } from "@/lib/search-params";
import { humanize } from "@/lib/format";
import { JobCard } from "@/components/marketplace/cards";
import { AdSlot } from "@/components/marketplace/ad-slot";
import { EmptyState, Pagination, buttonClass } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";

export const metadata: Metadata = { title: "Jobs in Hawassa" };

const TYPES = ["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "VOLUNTEER", "DAILY_LABOR"];
const LEVELS = ["ENTRY", "JUNIOR", "MID", "SENIOR", "MANAGER"];

async function JobsPageContent({ searchParams }: PageProps<"/jobs">) {
  await connection(); // live data: render per request
  const sp = await searchParams;
  const filters = {
    q: str(sp, "q"),
    type: TYPES.includes(str(sp, "type") ?? "") ? str(sp, "type") : undefined,
    level: LEVELS.includes(str(sp, "level") ?? "") ? str(sp, "level") : undefined,
    location: str(sp, "location"),
    category: str(sp, "category"),
    minSalary: int(sp, "minSalary") ? int(sp, "minSalary")! * 100 : undefined,
    page: int(sp, "page"),
  };
  const [result, locations, categories] = await Promise.all([searchJobs(filters), areaLocations(), jobCategories()]);

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Find a job</h1>
      <p className="mt-1 text-sm text-muted">{result.total} open {result.total === 1 ? "vacancy" : "vacancies"}</p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[280px_1fr]">
        <form method="get" className="space-y-4 self-start rounded-xl border border-line bg-card p-4" aria-label="Filter jobs">
          <Filter label="Keyword">
            <input name="q" defaultValue={filters.q} placeholder="Title, skill, company" className={inputClass} />
          </Filter>
          <Filter label="Category">
            <select name="category" defaultValue={filters.category ?? ""} className={inputClass}>
              <option value="">All categories</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </Filter>
          <Filter label="Employment type">
            <select name="type" defaultValue={filters.type ?? ""} className={inputClass}>
              <option value="">Any type</option>
              {TYPES.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </Filter>
          <Filter label="Experience level">
            <select name="level" defaultValue={filters.level ?? ""} className={inputClass}>
              <option value="">Any level</option>
              {LEVELS.map((t) => <option key={t} value={t}>{humanize(t)}</option>)}
            </select>
          </Filter>
          <Filter label="Location">
            <select name="location" defaultValue={filters.location ?? ""} className={inputClass}>
              <option value="">All areas</option>
              {locations.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
            </select>
          </Filter>
          <Filter label="Minimum monthly salary (ETB)">
            <input name="minSalary" type="number" min={0} step={500} defaultValue={int(sp, "minSalary")} className={inputClass} />
          </Filter>
          <div className="flex gap-2">
            <button className={buttonClass("primary", "md", "flex-1")}>Apply filters</button>
            <Link href="/jobs" className={buttonClass("outline", "md")}>Reset</Link>
          </div>
        </form>

        <div>
          <AdSlot slot="JOBS" className="mb-8" title="Sponsored jobs" />
          {result.jobs.length === 0 ? (
            <EmptyState icon={<Briefcase className="h-8 w-8" />} title="No jobs match your search" description="Try removing some filters or check back later." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {result.jobs.map((j) => <JobCard key={j.id} job={j} />)}
            </div>
          )}
          <Pagination page={result.page} pages={result.pages} hrefFor={(p) => `/jobs${buildQuery(sp, { page: p })}`} />
        </div>
      </div>
    </div>
  );
}

function Filter({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-ink">{label}</span>
      {children}
    </label>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function JobsPage(props: PageProps<"/jobs">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <JobsPageContent {...props} />
    </Suspense>
  );
}
