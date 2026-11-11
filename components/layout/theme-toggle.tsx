"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Monitor, Moon, Sun } from "lucide-react";
import { THEME_STORAGE_KEY, type ThemePreference } from "@/lib/theme";
import { cx } from "@/components/ui/primitives";

function systemIsDark() {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && systemIsDark());
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

export interface ThemeLabels {
  label: string;
  light: string;
  dark: string;
  system: string;
}

/** Light / Dark / System picker. The preference lives in localStorage (per device). */
export function ThemeToggle({ labels, tone = "light", openUp = false }: { labels: ThemeLabels; tone?: "light" | "dark"; openUp?: boolean }) {
  const [pref, setPref] = useState<ThemePreference>("system");
  const [resolved, setResolved] = useState<"light" | "dark">("light");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Read the stored preference after mount (the pre-paint script already applied it).
  useEffect(() => {
    let stored: ThemePreference = "system";
    try {
      const v = localStorage.getItem(THEME_STORAGE_KEY);
      if (v === "light" || v === "dark" || v === "system") stored = v;
    } catch {
      /* storage unavailable */
    }
    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing with an external store (localStorage) on mount
    setPref(stored);
    setResolved(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
  }, []);

  // Follow OS changes while on "system".
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      apply("system");
      setResolved(mq.matches ? "dark" : "light");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  // Close the menu on outside click / Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const choose = (next: ThemePreference) => {
    setPref(next);
    try {
      localStorage.setItem(THEME_STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    apply(next);
    setResolved(document.documentElement.dataset.theme === "dark" ? "dark" : "light");
    setOpen(false);
  };

  const options: { value: ThemePreference; label: string; Icon: typeof Sun }[] = [
    { value: "light", label: labels.light, Icon: Sun },
    { value: "dark", label: labels.dark, Icon: Moon },
    { value: "system", label: labels.system, Icon: Monitor },
  ];
  const CurrentIcon = resolved === "dark" ? Moon : Sun;

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={labels.label}
        title={labels.label}
        className={cx(
          "flex h-9 w-9 items-center justify-center rounded-full ring-1 transition-colors",
          tone === "light" ? "bg-canvas text-ink ring-line hover:bg-brand-50" : "bg-white/10 text-white ring-white/15 hover:bg-white/20",
        )}
      >
        <CurrentIcon className="h-4 w-4 transition-transform duration-300" aria-hidden="true" key={resolved} />
      </button>
      {open && (
        <div role="menu" aria-label={labels.label} className={`absolute right-0 z-50 w-40 animate-pop-in ${openUp ? "bottom-full mb-2" : "mt-2"} overflow-hidden rounded-xl border border-line bg-card p-1 shadow-xl`}>
          {options.map(({ value, label, Icon }) => (
            <button
              key={value}
              type="button"
              role="menuitemradio"
              aria-checked={pref === value}
              onClick={() => choose(value)}
              className={cx("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-ink hover:bg-brand-50", pref === value && "font-semibold")}
            >
              <Icon className="h-4 w-4 text-muted" aria-hidden="true" />
              <span className="flex-1 text-left">{label}</span>
              {pref === value && <Check className="h-4 w-4 text-brand" aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
