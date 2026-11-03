"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";
import type { Locale } from "@/lib/i18n/config";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle, type ThemeLabels } from "./theme-toggle";

export function MobileNav({
  items,
  signedIn,
  dashboardHref,
  locale,
  labels,
  themeLabels,
}: {
  items: { href: string; label: string }[];
  signedIn: boolean;
  dashboardHref: string | null;
  locale: Locale;
  labels: { signIn: string; join: string; dashboard: string; open: string; close: string; language: string };
  themeLabels: ThemeLabels;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-ink hover:bg-brand-50"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? labels.close : labels.open}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-16 animate-fade-up border-b border-line bg-card px-4 pb-4 shadow-lg">
          <nav aria-label="Mobile" className="flex flex-col py-2">
            {items.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-ink hover:bg-brand-50">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="mb-3 flex items-center gap-3 px-3">
            <LanguageSwitcher locale={locale} label={labels.language} />
            <ThemeToggle labels={themeLabels} />
          </div>
          <div className="flex gap-2">
            {signedIn && dashboardHref ? (
              <Link href={dashboardHref} className={buttonClass("primary", "md", "flex-1")} onClick={() => setOpen(false)}>{labels.dashboard}</Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("outline", "md", "flex-1")} onClick={() => setOpen(false)}>{labels.signIn}</Link>
                <Link href="/register" className={buttonClass("gold", "md", "flex-1")} onClick={() => setOpen(false)}>{labels.join}</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
