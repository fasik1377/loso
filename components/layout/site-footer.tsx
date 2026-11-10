import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import Link from "next/link";
import { Suspense } from "react";
import { Logo } from "@/components/brand/logo";
import { getDictionary } from "@/lib/i18n/server";

async function FooterContent() {
  const { t } = await getDictionary();
  const f = t.footer;
  const columns = [
    {
      title: f.explore,
      links: [
        { href: "/jobs", label: f.browseJobs },
        { href: "/services", label: f.findServices },
        { href: "/register", label: f.joinWorker },
        { href: "/register?type=employer", label: f.hireEmployer },
      ],
    },
    {
      title: f.company,
      links: [
        { href: "/about", label: f.about },
        { href: "/contact", label: f.contact },
        { href: "/help", label: f.helpCenter },
        { href: "/help#safety", label: f.trustSafety },
      ],
    },
    {
      title: f.legal,
      links: [
        { href: "/privacy", label: f.privacy },
        { href: "/terms", label: f.terms },
        { href: "/contact?topic=report", label: f.report },
      ],
    },
  ];
  return (
    <>
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-4">
        <div>
          <Logo tone="light" />
          <p className="mt-3 text-sm font-semibold text-gold">{f.tagline}</p>
          <p className="mt-2 text-sm text-white/70">{f.supporting}</p>
        </div>
        {columns.map((c) => (
          <div key={c.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-white/60">{c.title}</h2>
            <ul className="mt-3 space-y-2">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="text-sm text-white/85 transition-colors hover:text-gold">
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-white/10">
        <p className="mx-auto max-w-7xl px-4 py-4 text-xs text-white/60 sm:px-6">Looso · {f.location}</p>
      </div>
    </>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative mt-auto overflow-hidden bg-brand-deep text-white">
      <AnimatedBackdrop sparks={false} />
      <div aria-hidden="true" className="tilet relative opacity-70" />
      <div className="relative">
        <Suspense fallback={<div className="h-64" />}>
          <FooterContent />
        </Suspense>
      </div>
    </footer>
  );
}
