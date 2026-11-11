import type { ReactNode } from "react";
import Link from "next/link";
import { Users } from "lucide-react";
import { searchWorkers } from "@/lib/services/workers";
import { areaLocations, serviceCategories } from "@/lib/services/taxonomy";
import { buildQuery, int, str, type SP } from "@/lib/search-params";
import { WorkerCard } from "./cards";
import { AdSlot } from "./ad-slot";
import { EmptyState, Pagination, buttonClass } from "@/components/ui/primitives";
import { inputClass } from "@/components/ui/form";

/** Shared worker search used by /services and /services/[category]. */
export async function WorkerSearchView({ sp, basePath, fixedCategory }: { sp: SP; basePath: string; fixedCategory?: string }) {
  const filters = {
    q: str(sp, "q"),
    category: fixedCategory ?? str(sp, "category"),
    location: str(sp, "location"),
    minRating: Math.min(5, int(sp, "minRating") ?? 0) || undefined,
    available: str(sp, "available") === "1",
    maxPrice: int(sp, "maxPrice") ? int(sp, "maxPrice")! * 100 : undefined,
    page: int(sp, "page"),
  };
  const [result, locations, categories] = await Promise.all([searchWorkers(filters), areaLocations(), serviceCategories()]);

  return (
    <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
      <form method="get" action={basePath} className="space-y-4 self-start rounded-xl border border-line bg-card p-4" aria-label="Filter workers">
        <Filter label="Search">
          <input name="q" defaultValue={filters.q} placeholder="Name, service or skill" className={inputClass} />
        </Filter>
        {!fixedCategory && (
          <Filter label="Service">
            <select name="category" defaultValue={filters.category ?? ""} className={inputClass}>
              <option value="">All services</option>
              {categories.map((c) => <option key={c.id} value={c.slug}>{c.name}</option>)}
            </select>
          </Filter>
        )}
        <Filter label="Area">
          <select name="location" defaultValue={filters.location ?? ""} className={inputClass}>
            <option value="">All areas</option>
            {locations.map((l) => <option key={l.id} value={l.slug}>{l.name}</option>)}
          </select>
        </Filter>
        <Filter label="Minimum rating">
          <select name="minRating" defaultValue={String(filters.minRating ?? "")} className={inputClass}>
            <option value="">Any rating</option>
            {[4, 3, 2].map((r) => <option key={r} value={r}>{r}+ stars</option>)}
          </select>
        </Filter>
        <Filter label="Max starting price (ETB)">
          <input name="maxPrice" type="number" min={0} step={50} defaultValue={int(sp, "maxPrice")} className={inputClass} />
        </Filter>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="available" value="1" defaultChecked={filters.available} className="h-4 w-4 accent-brand" />
          Available now
        </label>
        <div className="flex gap-2">
          <button className={buttonClass("primary", "md", "flex-1")}>Apply filters</button>
          <Link href={basePath} className={buttonClass("outline", "md")}>Reset</Link>
        </div>
      </form>
      <div>
        <AdSlot slot="SERVICES" className="mb-8" title="Sponsored" />
        <p className="mb-3 text-sm text-muted">{result.total} {result.total === 1 ? "worker" : "workers"} found</p>
        {result.workers.length === 0 ? (
          <EmptyState icon={<Users className="h-8 w-8" />} title="No workers match your search" description="Try a different area or remove some filters." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {result.workers.map((w) => <WorkerCard key={w.id} worker={w} />)}
          </div>
        )}
        <Pagination page={result.page} pages={result.pages} hrefFor={(p) => `${basePath}${buildQuery(sp, { page: p })}`} />
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
