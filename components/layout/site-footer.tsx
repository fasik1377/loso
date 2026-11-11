import Link from "next/link";
import { Suspense } from "react";
import { ArrowRight, ArrowUp, BadgeCheck, LifeBuoy, Lock, Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { buttonClass } from "@/components/ui/primitives";
import { getDictionary } from "@/lib/i18n/server";
import { getSettings } from "@/lib/settings";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";

const TRUST_ICONS = [BadgeCheck, Lock, MapPin];

async function FooterContent() {
  const [{ t, locale }, settings] = await Promise.all([getDictionary(), getSettings()]);
  const f = t.footer;
  const year = new Date().getFullYear();
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
      title: f.support,
      links: [
        { href: "/support", label: f.supportCenter },
        { href: "/help", label: f.helpCenter },
        { href: "/contact", label: f.contact },
        { href: "/help#safety", label: f.safetyTips },
        { href: "/support?topic=safety#contact-support", label: f.report },
      ],
    },
    {
      title: f.company,
      links: [
        { href: "/about", label: f.about },
        { href: "/privacy", label: f.privacy },
        { href: "/terms", label: f.terms },
      ],
    },
  ];

  return (
    <>
      {/* Call to action */}
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <div className="group relative overflow-hidden rounded-3xl bg-gradient-to-br from-white/[0.09] to-white/[0.02] p-6 ring-1 ring-white/10 sm:p-10">
          <div aria-hidden="true" className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-gold/20 blur-3xl transition-transform duration-700 group-hover:scale-125" />
          <div className="relative flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
            <div>
              <p className="font-display text-sm font-semibold uppercase tracking-[0.2em] text-gold">{f.tagline}</p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-tight sm:text-4xl">{f.ctaTitle}</h2>
              <p className="mt-2 max-w-xl text-white/70">{f.ctaText}</p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-3">
              <Link href="/register" className={buttonClass("gold", "lg", "group/btn shadow-lg shadow-gold/20")}>
                {f.ctaJoin} <ArrowRight className="h-4 w-4 transition-transform group-hover/btn:translate-x-1" aria-hidden="true" />
              </Link>
              <Link href="/support" className={buttonClass("primary", "lg", "bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20")}>
                <LifeBuoy className="h-4 w-4" aria-hidden="true" /> {f.ctaSupport}
              </Link>
            </div>
          </div>
        </div>

        {/* What Looso promises */}
        <ul className="mt-6 grid gap-3 sm:grid-cols-3">
          {f.trust.map((item, i) => {
            const Icon = TRUST_ICONS[i] ?? BadgeCheck;
            return (
              <li key={item} className="flex items-center gap-3 rounded-2xl bg-white/[0.04] px-4 py-3 text-sm text-white/85 ring-1 ring-white/10">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-teal/20 text-teal">
                  <Icon className="h-4 w-4" aria-hidden="true" />
                </span>
                {item}
              </li>
            );
          })}
        </ul>
      </div>

      {/* Brand + links */}
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-2 lg:grid-cols-[1.5fr_1fr_1fr_1fr]">
        <div>
          <Logo tone="light" size="lg" />
          <p className="mt-4 max-w-xs text-sm leading-relaxed text-white/70">{f.supporting}</p>
          <ul className="mt-5 space-y-2.5 text-sm text-white/80">
            <li className="flex items-center gap-2.5">
              <MapPin className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" /> {f.location}
            </li>
            {settings.supportPhone && (
              <li>
                <a href={`tel:${settings.supportPhone}`} className="inline-flex items-center gap-2.5 transition-colors hover:text-gold">
                  <Phone className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" /> {settings.supportPhone}
                </a>
              </li>
            )}
            {settings.supportEmail && (
              <li>
                <a href={`mailto:${settings.supportEmail}`} className="inline-flex items-center gap-2.5 break-all transition-colors hover:text-gold">
                  <Mail className="h-4 w-4 shrink-0 text-gold" aria-hidden="true" /> {settings.supportEmail}
                </a>
              </li>
            )}
          </ul>
        </div>
        {columns.map((c) => (
          <nav key={c.title} aria-label={c.title}>
            <h2 className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/50">
              <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
              {c.title}
            </h2>
            <ul className="mt-5 space-y-3">
              {c.links.map((l) => (
                <li key={l.href}>
                  <Link href={l.href} className="group inline-flex items-center gap-1.5 text-sm text-white/80 transition-colors hover:text-white">
                    <span className="h-px w-0 bg-gold transition-all duration-300 group-hover:w-3" aria-hidden="true" />
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        ))}
      </div>

      {/* Oversized wordmark, outlined and fading into the page edge */}
      <div aria-hidden="true" className="pointer-events-none select-none overflow-hidden">
        <p
          className="mx-auto -mb-[0.22em] max-w-7xl px-4 text-center font-display text-[24vw] font-extrabold leading-none tracking-[-0.05em] text-transparent sm:px-6 lg:text-[16rem]"
          style={{
            WebkitTextStroke: "1px rgb(255 255 255 / 0.12)",
            maskImage: "linear-gradient(to bottom, black 30%, transparent 95%)",
            WebkitMaskImage: "linear-gradient(to bottom, black 30%, transparent 95%)",
          }}
        >
          Looso
        </p>
      </div>

      {/* Bottom bar */}
      <div className="relative border-t border-white/10 bg-black/10">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-5 text-xs text-white/60 sm:px-6 lg:flex-row lg:items-center lg:justify-between">
          <p>
            © {year} Looso · {f.rights}
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
            <Link href="/privacy" className="transition-colors hover:text-white">{f.privacy}</Link>
            <Link href="/terms" className="transition-colors hover:text-white">{f.terms}</Link>
            <LanguageSwitcher locale={locale} label={t.language.label} tone="dark" />
            <ThemeToggle labels={t.theme} tone="dark" openUp />
            <a href="#top" className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1.5 text-white/80 ring-1 ring-white/15 transition-colors hover:bg-gold hover:text-on-gold hover:ring-gold">
              <ArrowUp className="h-3.5 w-3.5" aria-hidden="true" /> {f.backToTop}
            </a>
          </div>
        </div>
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
        <Suspense fallback={<div className="h-[40rem]" />}>
          <FooterContent />
        </Suspense>
      </div>
    </footer>
  );
}
