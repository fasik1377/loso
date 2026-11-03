import { activeAdsFor } from "@/lib/services/ads";
import { fileUrl } from "@/lib/services/files";
import type { AdPlacementSlot } from "@/lib/generated/prisma";
import { SponsoredLabel } from "@/components/ui/status";
import { ImpressionBeacon } from "./impression-beacon";

/**
 * Renders approved, in-window promotional ads for a placement. Ad content is plain text + an
 * image from our own file route — never advertiser HTML/scripts. Clicks go through /api/ads/:id/click,
 * which records the event and redirects only to a sanitized http(s) URL.
 */
export async function AdSlot({ slot, className = "" }: { slot: AdPlacementSlot; className?: string }) {
  const ads = await activeAdsFor(slot, 2);
  if (ads.length === 0) return null;
  return (
    <aside aria-label="Sponsored" className={`grid gap-4 ${ads.length > 1 ? "md:grid-cols-2" : ""} ${className}`}>
      {ads.map((ad) => {
        const inner = (
          <div className="flex h-full items-center gap-4 rounded-xl border border-gold/40 bg-gold-50 p-4">
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
        return (
          <div key={ad.id}>
            <ImpressionBeacon adId={ad.id} slot={slot} />
            {ad.destinationUrl ? (
              <a href={`/api/ads/${ad.id}/click?slot=${slot}`} rel="sponsored noopener" target="_blank" className="block h-full">
                {inner}
              </a>
            ) : (
              inner
            )}
          </div>
        );
      })}
    </aside>
  );
}
