import { Suspense } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  Briefcase,
  ChevronDown,
  CreditCard,
  FileCheck2,
  LifeBuoy,
  Mail,
  Phone,
  ShieldAlert,
  UserCheck,
  Wrench,
  type LucideIcon,
} from "lucide-react";
import { getSettings } from "@/lib/settings";
import { getDictionary } from "@/lib/i18n/server";
import { str } from "@/lib/search-params";
import { ButtonLink, Card, CardBody, cx } from "@/components/ui/primitives";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import { ContactForm } from "../contact/contact-form";

export const metadata: Metadata = {
  title: "Support",
  description: "Get help with your Looso account, registration fee, verification, jobs and services, or contact the support team.",
};

const TOPIC_ICONS: Record<string, LucideIcon> = {
  account: UserCheck,
  payment: CreditCard,
  verification: FileCheck2,
  jobs: Briefcase,
  services: Wrench,
  safety: ShieldAlert,
};

async function SupportPageContent({ searchParams }: PageProps<"/support">) {
  await connection(); // live data: render per request
  const [{ t }, settings, sp] = await Promise.all([getDictionary(), getSettings(), searchParams]);
  const s = t.support;
  const topicKey = str(sp, "topic", 40);
  const topic = s.topics.find((x) => x.key === topicKey);

  return (
    <>
      {/* Header band */}
      <section className="relative overflow-hidden bg-brand-deep text-white">
        <AnimatedBackdrop />
        <div className="relative mx-auto max-w-5xl px-4 py-14 text-center sm:px-6 sm:py-16">
          <span className="mx-auto flex h-14 w-14 animate-pop-in items-center justify-center rounded-2xl bg-gold text-on-gold shadow-lg shadow-black/20">
            <LifeBuoy className="h-7 w-7" aria-hidden="true" />
          </span>
          <h1 className="mt-5 animate-fade-up font-display text-4xl font-extrabold tracking-tight sm:text-5xl">{s.heading}</h1>
          <p className="mx-auto mt-3 max-w-xl animate-fade-up text-white/75 [animation-delay:100ms]">{s.intro}</p>
          <div className="mt-6 flex animate-fade-up flex-wrap justify-center gap-3 [animation-delay:180ms]">
            <ButtonLink href="#contact-support" variant="gold">
              {s.contactTitle} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="/account-status" className="bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">
              {s.statusLink}
            </ButtonLink>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-6xl space-y-14 px-4 py-12 sm:px-6">
        {/* Topics */}
        <section aria-labelledby="topics-title">
          <h2 id="topics-title" className="text-xl font-bold text-ink">{s.topicsTitle}</h2>
          <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {s.topics.map((tp, i) => {
              const Icon = TOPIC_ICONS[tp.key] ?? LifeBuoy;
              const active = tp.key === topic?.key;
              return (
                <Link
                  key={tp.key}
                  href={`/support?topic=${tp.key}#contact-support`}
                  scroll={false}
                  style={{ animationDelay: `${i * 60}ms` }}
                  className={cx(
                    "group flex animate-fade-up gap-4 rounded-2xl border bg-card p-5 transition-all hover:-translate-y-0.5 hover:shadow-md",
                    active ? "border-teal ring-2 ring-teal/30" : "border-line hover:border-teal/50",
                  )}
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700 transition-colors group-hover:bg-teal group-hover:text-white">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span>
                    <span className="block font-semibold text-ink">{tp.title}</span>
                    <span className="mt-0.5 block text-sm text-muted">{tp.text}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>

        {/* Contact + channels */}
        <section id="contact-support" className="grid scroll-mt-24 gap-6 lg:grid-cols-[1fr_320px]">
          <Card>
            <CardBody className="p-6 sm:p-8">
              <h2 className="text-xl font-bold text-ink">{s.contactTitle}</h2>
              <p className="mt-1 text-sm text-muted">{s.contactText}</p>
              <div className="mt-6">
                <ContactForm labels={s.form} defaultSubject={topic?.title} />
              </div>
            </CardBody>
          </Card>

          <aside className="space-y-4">
            <Card>
              <CardBody>
                <h2 className="font-semibold text-ink">{s.channelsTitle}</h2>
                <ul className="mt-4 space-y-3 text-sm">
                  {settings.supportPhone && (
                    <li>
                      <a href={`tel:${settings.supportPhone}`} className="group flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-teal/50">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Phone className="h-4 w-4" aria-hidden="true" /></span>
                        <span>
                          <span className="block text-xs text-muted">{s.phone}</span>
                          <span className="font-semibold text-ink">{settings.supportPhone}</span>
                        </span>
                      </a>
                    </li>
                  )}
                  {settings.supportEmail && (
                    <li>
                      <a href={`mailto:${settings.supportEmail}`} className="group flex items-center gap-3 rounded-xl border border-line p-3 transition-colors hover:border-teal/50">
                        <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Mail className="h-4 w-4" aria-hidden="true" /></span>
                        <span className="min-w-0">
                          <span className="block text-xs text-muted">{s.email}</span>
                          <span className="block truncate font-semibold text-ink">{settings.supportEmail}</span>
                        </span>
                      </a>
                    </li>
                  )}
                  {!settings.supportPhone && !settings.supportEmail && <li className="text-muted">{s.noChannels}</li>}
                </ul>
                <p className="mt-4 text-xs text-muted">{s.reply}</p>
              </CardBody>
            </Card>

            <div className="relative overflow-hidden rounded-2xl bg-brand-deep p-5 text-white">
              <AnimatedBackdrop sparks={false} />
              <div className="relative">
                <ShieldAlert className="h-6 w-6 text-gold" aria-hidden="true" />
                <h2 className="mt-3 font-semibold">{s.reportTitle}</h2>
                <p className="mt-1 text-sm text-white/75">{s.reportText}</p>
                <Link href="/help#safety" className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-gold hover:underline">
                  {s.reportButton} <ArrowRight className="h-4 w-4" aria-hidden="true" />
                </Link>
              </div>
            </div>
          </aside>
        </section>

        {/* FAQ */}
        <section aria-labelledby="faq-title">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <h2 id="faq-title" className="text-xl font-bold text-ink">{s.faqTitle}</h2>
            <Link href="/help" className="inline-flex items-center gap-1 text-sm font-semibold text-brand hover:underline">
              {s.helpLink} <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          <div className="mt-5 divide-y divide-line overflow-hidden rounded-2xl border border-line bg-card">
            {s.faq.map((f) => (
              <details key={f.q} className="group">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-medium text-ink hover:bg-canvas [&::-webkit-details-marker]:hidden">
                  {f.q}
                  <ChevronDown className="h-5 w-5 shrink-0 text-muted transition-transform group-open:rotate-180" aria-hidden="true" />
                </summary>
                <p className="px-5 pb-5 text-sm text-muted">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
      </div>
    </>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function SupportPage(props: PageProps<"/support">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <SupportPageContent {...props} />
    </Suspense>
  );
}
