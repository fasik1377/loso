import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { serviceCategories } from "@/lib/services/taxonomy";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { WorkerSearchView } from "@/components/marketplace/worker-search";

export const metadata: Metadata = { title: "Find skilled workers" };

async function ServicesPageContent({ searchParams }: PageProps<"/services">) {
  await connection(); // live data: render per request
  const sp = await searchParams;
  const categories = await serviceCategories();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold text-ink">Find a service</h1>
      <p className="mt-1 text-sm text-muted">Browse local professionals by service, area and rating.</p>
      <nav aria-label="Service categories" className="mt-6 flex gap-2 overflow-x-auto pb-2">
        {categories.map((c) => (
          <Link key={c.id} href={`/services/${c.slug}`} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-card px-4 py-2 text-sm text-ink hover:border-brand hover:text-brand">
            <CategoryIcon name={c.icon} className="h-4 w-4" /> {c.name}
          </Link>
        ))}
      </nav>
      <div className="mt-6">
        <WorkerSearchView sp={sp} basePath="/services" />
      </div>
    </div>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function ServicesPage(props: PageProps<"/services">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <ServicesPageContent {...props} />
    </Suspense>
  );
}
