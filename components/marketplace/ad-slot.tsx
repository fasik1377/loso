import { ArrowUpRight, Briefcase, MapPin, Megaphone } from "lucide-react";
import { activeAdsFor, type ActiveAd } from "@/lib/services/ads";
import { fileUrl } from "@/lib/services/files";
import type { AdPlacementSlot } from "@/lib/generated/prisma";
import { formatRange } from "@/lib/money";
import { humanize } from "@/lib/format";
import { Avatar, cx } from "@/components/ui/primitives";
import { SponsoredLabel } from "@/components/ui/status";
import { ImpressionBeacon } from "./impression-beacon";

/**
 * Renders approved, in-window promotional ads for a placement. Ad content is plain text + an
 * image from our own file route — never advertiser HTML/scripts. Clicks go through /api/ads/:id/click,
 * which records the event and redirects to the sponsored job or a sanitized http(s) URL.
 */
export async function AdSlot({ slot, className = "", take = 2, title }: { slot: AdPlacementSlot; className?: string; take?: number; title?: string }) {
  const ads = await activeAdsFor(slot, take);
  if (ads.length === 0) return null;
  return (
    <aside aria-label="Sponsored" className={className}>
      {title && (
        <div className="mb-3 flex items-center gap-2">
          <Megaphone className="h-4 w-4 text-gold-600" aria-hidden="true" />
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
        </div>
      )}
      <div className={cx("grid gap-4", ads.length > 1 && "md:grid-cols-2", ads.length > 2 && "lg:grid-cols-3")}>
        {ads.map((ad) => (
          <div key={ad.id} className="animate-fade-up">
            <ImpressionBeacon adId={ad.id} slot={slot} />
            {ad.job || ad.destinationUrl ? (
              <a
                href={`/api/ads/${ad.id}/click?slot=${slot}`}
                rel={ad.job ? undefined : "sponsored noopener"}
                target={ad.job ? undefined : "_blank"}
                className="group block h-full"
              >
                <AdCard ad={ad} />
              </a>
            ) : (
              <AdCard ad={ad} />
            )}
          </div>
        ))}
      </div>
    </aside>
  );
}

function AdCard({ ad }: { ad: ActiveAd }) {
  const job = ad.job;
  if (job) {
    const salary = job.salaryVisible ? formatRange(job.salaryMinMinor, job.salaryMaxMinor, job.currency) : null;
    return (
      <div className="relative flex h-full flex-col overflow-hidden rounded-2xl border border-gold/50 bg-card p-5 shadow-sm transition-all group-hover:-translate-y-0.5 group-hover:shadow-md">
        <div className="absolute inset-x-0 top-0 h-1 bg-gradient-to-r from-gold to-gold-600" aria-hidden="true" />
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <Avatar name={job.company.name} src={fileUrl(job.company.logoFileId)} size={44} />
            <div className="min-w-0">
              <p className="font-semibold text-ink group-hover:text-brand">{ad.title}</p>
              <p className="text-sm text-muted">{job.company.name}</p>
            </div>
          </div>
          <SponsoredLabel />
        </div>
        {ad.body && <p className="mt-3 text-sm text-ink/80">{ad.body}</p>}
        <div className="mt-auto flex flex-wrap items-center gap-x-4 gap-y-1 pt-4 text-xs text-muted">
          <span className="inline-flex items-center gap-1"><Briefcase className="h-3.5 w-3.5" aria-hidden="true" /> {job.title} · {humanize(job.employmentType)}</span>
          {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" aria-hidden="true" /> {job.location.name}</span>}
          {salary && <span className="font-semibold text-brand">{salary}</span>}
          <span className="ml-auto inline-flex items-center gap-1 font-semibold text-brand">View job <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" /></span>
        </div>
      </div>
    );
  }
  return (
    <div className="flex h-full items-center gap-4 rounded-2xl border border-gold/40 bg-gold-50 p-4 transition-shadow group-hover:shadow-md">
      {ad.imageFileId && (
        // eslint-disable-next-line @next/next/no-img-element -- authorized file route
        <img src={fileUrl(ad.imageFileId)!} alt="" className="h-20 w-28 shrink-0 rounded-lg object-cover" loading="lazy" width={112} height={80} />
      )}
      <div className="min-w-0">
        <SponsoredLabel />
        <p className="mt-1 font-semibold text-ink">{ad.title}</p>
        {ad.body && <p className="text-sm text-muted">{ad.body}</p>}
        <p className="mt-1 text-xs text-muted">{ad.businessName}</p>
      </div>
    </div>
  );
}
