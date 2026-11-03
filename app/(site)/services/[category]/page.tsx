import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { db } from "@/lib/db";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { WorkerSearchView } from "@/components/marketplace/worker-search";

export const metadata: Metadata = { title: "Service category" };

export default async function ServiceCategoryPage({ params, searchParams }: PageProps<"/services/[category]">) {
  const [{ category: slug }, sp] = await Promise.all([params, searchParams]);
  const category = await db.serviceCategory.findFirst({ where: { slug, active: true } });
  if (!category) notFound();
  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
      <Link href="/services" className="inline-flex items-center gap-1 text-sm text-muted hover:text-brand">
        <ChevronLeft className="h-4 w-4" /> All services
      </Link>
      <div className="mt-3 flex items-center gap-3">
        <span className="rounded-full bg-brand-50 p-3 text-brand">
          <CategoryIcon name={category.icon} />
        </span>
        <div>
          <h1 className="text-2xl font-bold text-ink">{category.name}</h1>
          {category.description && <p className="text-sm text-muted">{category.description}</p>}
        </div>
      </div>
      <div className="mt-6">
        <WorkerSearchView sp={sp} basePath={`/services/${category.slug}`} fixedCategory={category.slug} />
      </div>
    </div>
  );
}
