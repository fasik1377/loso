"use client";

import { useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe } from "lucide-react";
import { setLocaleAction } from "@/lib/actions/locale";
import { LOCALES, LOCALE_LABELS, type Locale } from "@/lib/i18n/config";
import { cx } from "@/components/ui/primitives";

/** EN / አማ toggle. Also keeps <html lang> in sync (drives screen readers and the Ethiopic font). */
export function LanguageSwitcher({ locale, label, tone = "light" }: { locale: Locale; label: string; tone?: "light" | "dark" }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);

  const choose = (next: Locale) => {
    if (next === locale) return;
    startTransition(async () => {
      await setLocaleAction(next);
      router.refresh();
    });
  };

  return (
    <div
      role="group"
      aria-label={label}
      className={cx(
        "inline-flex items-center gap-0.5 rounded-full p-0.5 text-xs font-semibold ring-1",
        tone === "light" ? "bg-canvas ring-line" : "bg-white/10 ring-white/15",
        pending && "opacity-60",
      )}
    >
      <Globe className={cx("ml-1.5 mr-0.5 h-3.5 w-3.5", tone === "light" ? "text-muted" : "text-white/70")} aria-hidden="true" />
      {LOCALES.map((l) => (
        <button
          key={l}
          type="button"
          lang={l}
          onClick={() => choose(l)}
          aria-pressed={l === locale}
          title={LOCALE_LABELS[l].name}
          disabled={pending}
          className={cx(
            "rounded-full px-2.5 py-1 transition-colors",
            l === locale
              ? tone === "light"
                ? "bg-brand text-on-brand"
                : "bg-gold text-on-gold"
              : tone === "light"
                ? "text-muted hover:text-ink"
                : "text-white/80 hover:text-white",
          )}
        >
          {LOCALE_LABELS[l].short}
        </button>
      ))}
    </div>
  );
}
