import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BadgeCheck, Briefcase, Building2, LifeBuoy, Lock, ShieldCheck, Star, User, type LucideIcon } from "lucide-react";
import { getDictionary } from "@/lib/i18n/server";
import { ButtonLink, Card } from "@/components/ui/primitives";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { Reveal } from "@/components/ui/reveal";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";

export const metadata: Metadata = {
  title: "How it works",
  description: "How Looso works for workers, customers and employers: sign up with your phone number, get approved by an administrator, then find work or hire.",
};

/** Same order as `howItWorks.roles` in the dictionaries. */
const ROLES: { icon: LucideIcon; href: string; accent: string }[] = [
  { icon: Briefcase, href: "/register", accent: "bg-gold text-on-gold" },
  { icon: User, href: "/register?type=customer", accent: "bg-teal text-white" },
  { icon: Building2, href: "/register?type=employer", accent: "bg-brand text-on-brand" },
];
const TRUST_ICONS: LucideIcon[] = [BadgeCheck, Lock, Star];

async function HowItWorksContent() {
  await connection(); // language comes from a cookie
  const { t } = await getDictionary();
  const h = t.howItWorks;

  return (
    <>
      {/* Intro */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <AnimatedBackdrop />
        <div className="relative mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 sm:py-20">
          <p className="animate-fade-up text-xs font-semibold uppercase tracking-[0.25em] text-gold">{t.nav.howItWorks}</p>
          <h1 className="mt-3 animate-fade-up font-display text-4xl font-extrabold tracking-tight [animation-delay:80ms] sm:text-6xl">{h.title}</h1>
          <p className="mx-auto mt-4 max-w-2xl animate-fade-up text-lg text-white/75 [animation-delay:160ms]">{h.intro}</p>
          {/* Jump links to each audience */}
          <nav aria-label={h.title} className="mt-8 flex animate-fade-up flex-wrap justify-center gap-2 [animation-delay:240ms]">
            {h.roles.map((r, i) => {
              const Icon = ROLES[i]?.icon ?? Briefcase;
              return (
                <a key={r.title} href={`#role-${i}`} className="inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium ring-1 ring-white/20 transition-colors hover:bg-white/20">
                  <Icon className="h-4 w-4 text-gold" aria-hidden="true" /> {r.title}
                </a>
              );
            })}
          </nav>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-16 px-4 py-14 sm:px-6">
        {/* Approval first */}
        <Reveal>
          <div className="flex flex-col gap-4 rounded-3xl border border-teal/30 bg-teal-50 p-6 sm:flex-row sm:items-center sm:p-8">
            <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-teal text-white">
              <ShieldCheck className="h-7 w-7" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-xl font-bold text-ink">{h.approvalTitle}</h2>
              <p className="mt-1 text-ink/80">{h.approvalText}</p>
            </div>
          </div>
        </Reveal>

        {/* One journey per audience */}
        {h.roles.map((r, i) => {
          const role = ROLES[i] ?? ROLES[0]!;
          const Icon = role.icon;
          return (
            <section key={r.title} id={`role-${i}`} aria-labelledby={`role-${i}-title`} className="scroll-mt-24">
              <Reveal>
                <div className="flex flex-wrap items-end justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${role.accent}`}>
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <div>
                      <h2 id={`role-${i}-title`} className="font-display text-2xl font-bold text-ink sm:text-3xl">{r.title}</h2>
                      <p className="text-muted">{r.summary}</p>
                    </div>
                  </div>
                  <ButtonLink href={role.href} variant={i === 0 ? "gold" : "primary"}>
                    {r.cta} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </ButtonLink>
                </div>
              </Reveal>
              <ol className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                {r.steps.map((step, s) => (
                  <li key={s}>
                    <Reveal delay={s * 80} className="h-full">
                      <Card className="relative h-full p-5 transition-all hover:-translate-y-1 hover:shadow-md">
                        <p className="text-xs font-semibold uppercase tracking-wider text-teal-700">
                          {h.stepLabel} {s + 1}
                        </p>
                        <p className="mt-2 text-sm text-ink">{step}</p>
                        {s < r.steps.length - 1 && (
                          <ArrowRight className="absolute -right-3 top-1/2 hidden h-5 w-5 -translate-y-1/2 text-gold-600 lg:block" aria-hidden="true" />
                        )}
                      </Card>
                    </Reveal>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}

        {/* Trust */}
        <section aria-labelledby="trust-title">
          <Reveal>
            <h2 id="trust-title" className="font-display text-2xl font-bold text-ink sm:text-3xl">{h.trustTitle}</h2>
          </Reveal>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            {h.trust.map((item, i) => {
              const Icon = TRUST_ICONS[i] ?? BadgeCheck;
              return (
                <Reveal key={item.title} delay={i * 100}>
                  <Card className="h-full p-6">
                    <span className="inline-flex rounded-xl bg-gold-50 p-3 text-gold-600">
                      <Icon className="h-6 w-6" aria-hidden="true" />
                    </span>
                    <h3 className="mt-4 font-semibold text-ink">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted">{item.text}</p>
                  </Card>
                </Reveal>
              );
            })}
          </div>
        </section>

        {/* Questions */}
        <Reveal>
          <div className="relative overflow-hidden rounded-3xl bg-brand-deep p-8 text-white sm:p-10">
            <AnimatedBackdrop sparks={false} />
            <div className="relative flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
              <div>
                <h2 className="font-display text-2xl font-bold sm:text-3xl">{h.questionsTitle}</h2>
                <p className="mt-1 text-white/75">{h.questionsText}</p>
              </div>
              <div className="flex flex-wrap gap-3">
                <ButtonLink href="/support" variant="gold">
                  <LifeBuoy className="h-4 w-4" aria-hidden="true" /> {h.supportButton}
                </ButtonLink>
                <Link href="/help" className="inline-flex h-10 items-center rounded-lg bg-white/10 px-4 text-sm font-semibold ring-1 ring-white/25 hover:bg-white/20">
                  {h.helpButton}
                </Link>
              </div>
            </div>
          </div>
        </Reveal>
      </div>
    </>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function HowItWorksPage() {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <HowItWorksContent />
    </Suspense>
  );
}
