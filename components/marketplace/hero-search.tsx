"use client";

import { useState } from "react";
import { Briefcase, MapPin, Search, Wrench } from "lucide-react";
import { buttonClass, cx } from "@/components/ui/primitives";

type Option = { value: string; label: string };

/** Two-mode search. Submits a plain GET form to /jobs or /services so it works without JS too. */
export function HeroSearch({ locations, serviceCategories, jobCategories }: { locations: Option[]; serviceCategories: Option[]; jobCategories: Option[] }) {
  const [mode, setMode] = useState<"jobs" | "services">("jobs");
  const categories = mode === "jobs" ? jobCategories : serviceCategories;
  return (
    <div className="rounded-2xl bg-white p-3 shadow-lg sm:p-4">
      <div role="tablist" aria-label="Search type" className="mb-3 inline-flex rounded-lg bg-canvas p-1">
        {(
          [
            ["jobs", "Find a Job", Briefcase],
            ["services", "Find a Service", Wrench],
          ] as const
        ).map(([value, label, Icon]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={mode === value}
            onClick={() => setMode(value)}
            className={cx(
              "inline-flex items-center gap-2 rounded-md px-4 py-2 text-sm font-semibold transition-colors",
              mode === value ? "bg-brand text-white" : "text-muted hover:text-ink",
            )}
          >
            <Icon className="h-4 w-4" aria-hidden="true" /> {label}
          </button>
        ))}
      </div>
      <form action={mode === "jobs" ? "/jobs" : "/services"} method="get" className="grid gap-2 md:grid-cols-[1fr_auto_auto_auto]">
        <label className="relative block">
          <span className="sr-only">{mode === "jobs" ? "Job title, skill or company" : "Service or worker name"}</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted" aria-hidden="true" />
          <input
            name="q"
            placeholder={mode === "jobs" ? "Job title, skill or company" : "e.g. electrician, plumber, cleaner"}
            className="h-12 w-full rounded-lg border border-line pl-10 pr-3 text-ink placeholder:text-slate-400 focus:border-brand focus:outline-none focus:ring-2 focus:ring-brand/20"
          />
        </label>
        <label className="relative block">
          <span className="sr-only">Category</span>
          <select name="category" className="h-12 w-full rounded-lg border border-line bg-white px-3 text-sm text-ink md:w-44">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
        </label>
        <label className="relative block">
          <span className="sr-only">Area</span>
          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" aria-hidden="true" />
          <select name="location" className="h-12 w-full rounded-lg border border-line bg-white pl-8 pr-3 text-sm text-ink md:w-44">
            <option value="">All of Hawassa</option>
            {locations.map((l) => (
              <option key={l.value} value={l.value}>{l.label}</option>
            ))}
          </select>
        </label>
        <button type="submit" className={buttonClass("gold", "lg")}>Search</button>
      </form>
    </div>
  );
}
