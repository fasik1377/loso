import Link from "next/link";
import type { ReactNode } from "react";
import { Award, Building2, Crown, Star } from "lucide-react";
import { fileUrl } from "@/lib/services/files";
import type { topRated } from "@/lib/services/companies";
import { Avatar, Card, cx } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

type TopRated = Awaited<ReturnType<typeof topRated>>;

/** Homepage showcase of the best-rated workers and employers (real reviews only). */
export function TopRatedShowcase({ data, t }: { data: TopRated; t: Dictionary["spotlight"] }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Board
        labels={{ review: t.review, reviews: t.reviews }}
        title={t.topWorkers}
        icon={<Award className="h-5 w-5 text-gold-600" aria-hidden="true" />}
        empty={t.emptyWorkers}
        rows={data.workers.map((w) => ({
          key: w.id,
          href: `/workers/${w.user.id}`,
          name: w.user.fullName,
          sub: w.headline ?? w.services[0]?.category.name ?? t.serviceProvider,
          avatar: fileUrl(w.user.profile?.avatarFileId),
          rating: w.ratingAverage ?? 0,
          count: w.ratingCount,
          extra: `${w.completedCount} ${t.jobsDone}`,
        }))}
      />
      <Board
        labels={{ review: t.review, reviews: t.reviews }}
        title={t.topEmployers}
        icon={<Building2 className="h-5 w-5 text-gold-600" aria-hidden="true" />}
        empty={t.emptyEmployers}
        rows={data.companies.map((c) => ({
          key: c.id,
          href: `/companies/${c.id}`,
          name: c.name,
          sub: c.industry ?? t.verifiedEmployer,
          avatar: fileUrl(c.logoFileId),
          rating: c.ratingAverage ?? 0,
          count: c.ratingCount,
          extra: t.ratedByStaff,
        }))}
      />
    </div>
  );
}

interface Row {
  key: string;
  href: string;
  name: string;
  sub: string;
  avatar: string | null;
  rating: number;
  count: number;
  extra: string;
}

function Board({ title, icon, rows, empty, labels }: { title: string; icon: ReactNode; rows: Row[]; empty: string; labels: { review: string; reviews: string } }) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center gap-2 border-b border-line bg-gradient-to-r from-gold-50 to-card px-5 py-4">
        {icon}
        <h3 className="font-semibold text-ink">{title}</h3>
      </div>
      {rows.length === 0 ? (
        <p className="px-5 py-8 text-center text-sm text-muted">{empty}</p>
      ) : (
        <ol className="divide-y divide-line">
          {rows.map((r, i) => (
            <li key={r.key}>
              <Link href={r.href} className="flex items-center gap-4 px-5 py-3 transition-colors hover:bg-canvas">
                <span
                  className={cx(
                    "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold",
                    i === 0 ? "bg-gold text-brand" : i === 1 ? "bg-line text-ink" : i === 2 ? "bg-amber-100 text-amber-800 dark:bg-amber-500/20 dark:text-amber-300" : "bg-canvas text-muted",
                  )}
                  aria-label={`Rank ${i + 1}`}
                >
                  {i === 0 ? <Crown className="h-4 w-4" aria-hidden="true" /> : i + 1}
                </span>
                <Avatar name={r.name} src={r.avatar} size={44} />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-ink">{r.name}</p>
                  <p className="truncate text-xs text-muted">{r.sub}</p>
                </div>
                <div className="text-right">
                  <p className="inline-flex items-center gap-1 font-semibold text-ink">
                    <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" /> {r.rating.toFixed(1)}
                  </p>
                  <p className="text-xs text-muted">{r.count} {r.count === 1 ? labels.review : labels.reviews} · {r.extra}</p>
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
