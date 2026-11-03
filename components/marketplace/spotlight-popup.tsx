"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Crown, Star, X } from "lucide-react";
import { Avatar } from "@/components/ui/primitives";
import type { Dictionary } from "@/lib/i18n/dictionaries/en";

export interface SpotlightItem {
  kind: "worker" | "company";
  href: string;
  name: string;
  sub: string;
  avatar: string | null;
  rating: number;
  count: number;
}

const KEY = "loso:spotlight-dismissed";

/**
 * A small, non-blocking "Top rated" card that slides in once per browser session.
 * It never covers the page, can be dismissed, and is skipped entirely if there is nothing to show.
 */
export function SpotlightPopup({ items, t }: { items: SpotlightItem[]; t: Dictionary["spotlight"] }) {
  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (items.length === 0) return;
    try {
      if (sessionStorage.getItem(KEY)) return;
    } catch {
      /* storage unavailable: still show once */
    }
    const t = setTimeout(() => setOpen(true), 4000);
    return () => clearTimeout(t);
  }, [items.length]);

  useEffect(() => {
    if (!open || items.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % items.length), 5000);
    return () => clearInterval(t);
  }, [open, items.length]);

  const close = () => {
    setOpen(false);
    try {
      sessionStorage.setItem(KEY, "1");
    } catch {
      /* ignore */
    }
  };

  if (!open || items.length === 0) return null;
  const item = items[index]!;

  return (
    <div
      role="dialog"
      aria-label={t.popupLabel}
      className="fixed bottom-4 left-4 right-4 z-50 animate-pop-in sm:left-6 sm:right-auto sm:w-96"
      onKeyDown={(e) => e.key === "Escape" && close()}
    >
      <div className="overflow-hidden rounded-2xl border border-line bg-card shadow-2xl">
        <div className="flex items-center justify-between bg-brand-deep px-4 py-2.5 text-white">
          <p className="inline-flex items-center gap-2 text-sm font-semibold">
            <Crown className="h-4 w-4 text-gold" aria-hidden="true" />
            {item.kind === "worker" ? t.popupWorker : t.popupEmployer}
          </p>
          <button type="button" onClick={close} className="rounded p-1 text-white/80 hover:bg-white/10 hover:text-white" aria-label={t.close}>
            <X className="h-4 w-4" />
          </button>
        </div>
        <Link href={item.href} onClick={close} className="flex items-center gap-4 p-4 hover:bg-canvas">
          <Avatar name={item.name} src={item.avatar} size={56} />
          <div className="min-w-0 flex-1">
            <p className="truncate font-semibold text-ink">{item.name}</p>
            <p className="truncate text-sm text-muted">{item.sub}</p>
            <p className="mt-1 inline-flex items-center gap-1 text-sm">
              <Star className="h-4 w-4 fill-gold text-gold" aria-hidden="true" />
              <span className="font-semibold text-ink">{item.rating.toFixed(1)}</span>
              <span className="text-muted">· {item.count} {item.count === 1 ? t.verifiedReview : t.verifiedReviews}</span>
            </p>
          </div>
          <span className="text-sm font-semibold text-brand">{t.view}</span>
        </Link>
        {items.length > 1 && (
          <div className="flex justify-center gap-1.5 pb-3" aria-hidden="true">
            {items.map((_, i) => (
              <span key={i} className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-brand" : "w-1.5 bg-line"}`} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
