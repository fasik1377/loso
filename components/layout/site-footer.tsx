import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { marketConfig } from "@/lib/config";

const COLUMNS = [
  {
    title: "Explore",
    links: [
      { href: "/jobs", label: "Browse jobs" },
      { href: "/services", label: "Find services" },
      { href: "/register", label: "Join as a worker" },
      { href: "/register?type=employer", label: "Hire as an employer" },
    ],
  },
  {
    title: "Loso",
    links: [
      { href: "/about", label: "About" },
      { href: "/contact", label: "Contact" },
      { href: "/help", label: "Help center" },
      { href: "/help#safety", label: "Trust & safety" },
    ],
  },
  {
    title: "Legal",
    links: [
      { href: "/privacy", label: "Privacy policy" },
      { href: "/terms", label: "Terms of use" },
      { href: "/contact?topic=report", label: "Report a problem" },
    ],
  },
];

export function SiteFooter() {
  return (
    <footer className="mt-auto bg-brand text-white">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm font-semibold text-gold">{marketConfig.tagline}</p>
          <p className="mt-2 text-sm text-white/70">{marketConfig.supportingMessage}</p>
        </div>
        {COLUMNS.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/85 hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/60 sm:px-6">
          Loso · {marketConfig.defaultCity}, {marketConfig.region}
        </p>
      </div>
    </footer>
  );
}
