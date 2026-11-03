"use client";

import { useEffect } from "react";

/** Records one impression per ad per page view (client-side, so crawlers/prefetches don't count). */
export function ImpressionBeacon({ adId, slot }: { adId: string; slot: string }) {
  useEffect(() => {
    const key = `ad-imp:${adId}:${slot}:${location.pathname}`;
    try {
      if (sessionStorage.getItem(key)) return;
      sessionStorage.setItem(key, "1");
    } catch {
      /* storage unavailable: still record */
    }
    navigator.sendBeacon?.(`/api/ads/${adId}/impression?slot=${slot}`);
  }, [adId, slot]);
  return null;
}
