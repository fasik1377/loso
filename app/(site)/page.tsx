import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { connection } from "next/server";
import {
  ArrowRight,
  BadgeCheck,
  Briefcase,
  Building2,
  CheckCircle2,
  Flag,
  Lock,
  MessageSquare,
  Search,
  ShieldCheck,
  Sparkles,
  Star,
  UserPlus,
  Users,
} from "lucide-react";
import { db } from "@/lib/db";
import { publicJobWhere, jobCompanySelect } from "@/lib/services/jobs";
import { publicWorkerWhere, workerUserSelect } from "@/lib/services/workers";
import { areaLocations, jobCategories, serviceCategories } from "@/lib/services/taxonomy";
import { topRated } from "@/lib/services/companies";
import { fileUrl } from "@/lib/services/files";
import { getDictionary } from "@/lib/i18n/server";
import { ButtonLink, Card, EmptyState } from "@/components/ui/primitives";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import { HeroSearch } from "@/components/marketplace/hero-search";
import { HeroMosaic } from "@/components/marketplace/hero-mosaic";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { JobCard, WorkerCard } from "@/components/marketplace/cards";
import { AdSlot } from "@/components/marketplace/ad-slot";
import { TopRatedShowcase } from "@/components/marketplace/spotlight";
import { SpotlightPopup, type SpotlightItem } from "@/components/marketplace/spotlight-popup";
import { CategoryMarquee } from "@/components/marketplace/category-marquee";
import { Reveal } from "@/components/ui/reveal";
import { CountUp } from "@/components/ui/count-up";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";

/** Hero shortcuts, in the same order as the translated `hero.popular` labels. */
const POPULAR_LINKS = ["/services/electrical", "/services/plumbing", "/jobs?q=driver", "/jobs?category=administration-and-office", "/services/cleaning"];

async function HomePageContent() {
  await connection(); // live data: render per request
  const [{ t }, services, jobCats, locations, jobs, workers, top, stats] = await Promise.all([
    getDictionary(),
    serviceCategories(),
    jobCategories(),
    areaLocations(),
    db.job.findMany({
      where: publicJobWhere(),
      include: { company: { select: jobCompanySelect }, location: true },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      take: 6,
    }),
    db.workerProfile.findMany({
      where: publicWorkerWhere(),
      include: {
        user: { select: workerUserSelect },
        services: { where: { active: true }, include: { category: true }, take: 2 },
        areas: { include: { location: true }, take: 2 },
      },
      orderBy: [{ ratingAverage: "desc" }, { completedCount: "desc" }],
      take: 6,
    }),
    topRated(5),
    Promise.all([
      db.workerProfile.count({ where: { user: { status: "ACTIVE", isDemo: false } } }),
      db.job.count({ where: publicJobWhere() }),
      db.serviceRequest.count({ where: { status: "COMPLETED" } }),
      db.company.count({ where: { status: "APPROVED", isDemo: false } }),
    ]),
  ]);
  const [workerCount, jobCount, completedCount, companyCount] = stats;
  const h = t.home;

  // Pop-up spotlight: #1 worker and #1 employer (plus runners-up), by real ratings only.
  const spotlight: SpotlightItem[] = [
    ...top.workers.slice(0, 2).map((w) => ({
      kind: "worker" as const,
      href: `/workers/${w.user.id}`,
      name: w.user.fullName,
      sub: w.headline ?? w.services[0]?.category.name ?? t.spotlight.serviceProvider,
      avatar: fileUrl(w.user.profile?.avatarFileId),
      rating: w.ratingAverage ?? 0,
      count: w.ratingCount,
    })),
    ...top.companies.slice(0, 2).map((c) => ({
      kind: "company" as const,
      href: `/companies/${c.id}`,
      name: c.name,
      sub: c.industry ?? t.spotlight.verifiedEmployer,
      avatar: fileUrl(c.logoFileId),
      rating: c.ratingAverage ?? 0,
      count: c.ratingCount,
    })),
  ];

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-brand-deep">
        <AnimatedBackdrop />
        <div className="relative mx-auto max-w-7xl px-4 pb-20 pt-10 sm:px-6 md:pt-14 lg:pb-24">
          <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-14">
            <div>
              <p className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold ring-1 ring-white/15">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> {t.hero.badge}
              </p>
              <h1 className="mt-5 animate-fade-up text-4xl font-extrabold leading-[1.08] tracking-tight text-white [animation-delay:80ms] sm:text-5xl xl:text-6xl">
                {t.hero.titleLine1}
                <br />
                {t.hero.titleLine2}
                <br />
                <span className="text-gold">{t.hero.titleLine3}</span>
              </h1>
              <p className="mt-5 max-w-lg animate-fade-up text-lg text-white/75 [animation-delay:160ms]">{t.hero.subtitle}</p>
              <div className="mt-7 flex animate-fade-up flex-wrap gap-3 [animation-delay:240ms]">
                <ButtonLink href="/jobs" variant="gold" size="lg">
                  <Briefcase className="h-5 w-5" aria-hidden="true" /> {t.hero.ctaFindWork}
                </ButtonLink>
                <ButtonLink href="/services" size="lg" className="bg-white/10 text-white ring-1 ring-white/25 hover:bg-white/20">
                  <Search className="h-5 w-5" aria-hidden="true" /> {t.hero.ctaHire}
                </ButtonLink>
              </div>
              <div className="mt-8 flex animate-fade-up flex-wrap items-center gap-2 [animation-delay:320ms]">
                <span className="mr-1 text-sm text-white/60">{t.hero.popularLabel}</span>
                {t.hero.popular.map((label, i) => (
                  <Link
                    key={label}
                    href={POPULAR_LINKS[i] ?? "/jobs"}
                    className="rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm text-white/85 transition-colors hover:border-gold/60 hover:bg-white/10 hover:text-white"
                  >
                    {label}
                  </Link>
                ))}
              </div>
            </div>
            <div className="animate-fade-up [animation-delay:200ms]">
              <HeroMosaic label={t.hero.photoGridLabel} />
            </div>
          </div>

          <div className="mt-10 animate-fade-up [animation-delay:320ms]">
            <HeroSearch
              t={t.search}
              locations={locations.map((l) => ({ value: l.slug, label: l.name }))}
              serviceCategories={services.map((c) => ({ value: c.slug, label: c.name }))}
              jobCategories={jobCats.map((c) => ({ value: c.slug, label: c.name }))}
            />
          </div>
        </div>
      </section>

      {/* Live stats */}
      <section aria-label={t.stats.label} className="relative z-10 mx-auto -mt-8 max-w-6xl px-4 sm:px-6">
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line shadow-xl shadow-brand/5 md:grid-cols-4">
          <StatTile icon={<Users className="h-5 w-5" />} value={workerCount} label={t.stats.verifiedWorkers} />
          <StatTile icon={<Briefcase className="h-5 w-5" />} value={jobCount} label={t.stats.openJobs} />
          <StatTile icon={<CheckCircle2 className="h-5 w-5" />} value={completedCount} label={t.stats.servicesCompleted} />
          <StatTile icon={<Building2 className="h-5 w-5" />} value={companyCount} label={t.stats.verifiedEmployers} />
        </div>
      </section>

      {/* Moving ribbon of services */}
      <div className="mx-auto mt-10 max-w-7xl px-4 sm:px-6">
        <CategoryMarquee label={h.servicesTitle} items={services.map((c) => ({ slug: c.slug, name: c.name, icon: c.icon }))} />
      </div>

      {/* Sponsored jobs (admin-posted paid placements) */}
      <div className="mx-auto max-w-7xl px-4 pt-14 sm:px-6">
        <Reveal>
          <AdSlot slot="HOME" take={3} title={h.sponsored} />
        </Reveal>
      </div>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={h.servicesEyebrow} title={h.servicesTitle} subtitle={h.servicesSubtitle} href="/services" linkLabel={h.allServices} />
        </Reveal>
        {services.length === 0 ? (
          <EmptyState title={h.noCategories} description={h.noCategoriesDesc} />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {services.slice(0, 10).map((c, i) => (
              <Link
                key={c.id}
                href={`/services/${c.slug}`}
                style={{ animationDelay: `${i * 50}ms` }}
                className="group flex animate-fade-up flex-col items-center gap-3 rounded-2xl border border-line bg-card p-5 text-center transition-all hover:-translate-y-1 hover:border-brand/40 hover:shadow-md"
              >
                <span className="rounded-2xl bg-brand-50 p-3.5 text-brand transition-all group-hover:scale-110 group-hover:bg-brand-deep group-hover:text-gold">
                  <CategoryIcon name={c.icon} />
                </span>
                <span className="text-sm font-medium text-ink">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Top rated */}
      <section className="relative overflow-hidden bg-card py-14">
        <AnimatedBackdrop tone="light" />
        <div className="relative mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading eyebrow={h.topEyebrow} title={h.topTitle} subtitle={h.topSubtitle} />
            <TopRatedShowcase data={top} t={t.spotlight} />
          </Reveal>
        </div>
      </section>

      {/* Jobs */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={h.jobsEyebrow} title={h.jobsTitle} subtitle={h.jobsSubtitle} href="/jobs" linkLabel={h.browseAllJobs} />
        </Reveal>
        {jobs.length === 0 ? (
          <EmptyState icon={<Briefcase className="h-8 w-8" />} title={h.noJobs} description={h.noJobsDesc} action={<ButtonLink href="/register?type=employer" variant="outline">{h.postJob}</ButtonLink>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j, i) => (
              <Reveal key={j.id} delay={i * 70}>
                <JobCard job={j} />
              </Reveal>
            ))}
          </div>
        )}
      </section>

      {/* Workers */}
      <section className="bg-card py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <Reveal>
            <SectionHeading eyebrow={h.workersEyebrow} title={h.workersTitle} subtitle={h.workersSubtitle} href="/services" linkLabel={h.findMoreWorkers} />
          </Reveal>
          {workers.length === 0 ? (
            <EmptyState title={h.noWorkers} description={h.noWorkersDesc} action={<ButtonLink href="/register" variant="outline">{h.offerServices}</ButtonLink>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((w, i) => (
                <Reveal key={w.id} delay={i * 70}>
                  <WorkerCard worker={w} />
                </Reveal>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-16 sm:px-6">
        <Reveal>
          <SectionHeading eyebrow={h.howEyebrow} title={h.howTitle} subtitle={h.howSubtitle} />
        </Reveal>
        <div className="grid gap-6 md:grid-cols-2">
          <Reveal>
            <HowColumn title={h.howWorkersTitle} icons={[UserPlus, BadgeCheck, Search, Star]} steps={h.howWorkersSteps} />
          </Reveal>
          <Reveal delay={120}>
            <HowColumn title={h.howEmployersTitle} icons={[Building2, Briefcase, MessageSquare, Star]} steps={h.howEmployersSteps} />
          </Reveal>
        </div>
      </section>

      {/* Benefits */}
      <section className="relative overflow-hidden bg-card py-14">
        <AnimatedBackdrop tone="light" sparks={false} />
        <div className="relative mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {h.benefits.map((b, i) => {
            const Icon = [ShieldCheck, Star, Lock][i] ?? ShieldCheck;
            return (
              <Reveal key={b.title} delay={i * 100}>
                <div className="group relative h-full overflow-hidden rounded-2xl border border-line bg-card p-6 transition-all hover:-translate-y-1 hover:border-gold/50 hover:shadow-lg">
                  <span className="relative inline-flex rounded-xl bg-gold-50 p-3 ring-1 ring-gold/20">
                    <Icon className="h-6 w-6 text-gold-600" aria-hidden="true" />
                  </span>
                  <h3 className="relative mt-4 font-semibold text-ink">{b.title}</h3>
                  <p className="relative mt-1 text-sm text-muted">{b.text}</p>
                </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Trust & safety */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <Reveal>
        <Card className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <span className="h-fit rounded-xl bg-danger/10 p-3">
              <Flag className="h-6 w-6 text-danger" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-lg font-semibold text-ink">{h.trustTitle}</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">{h.trustText}</p>
            </div>
          </div>
          <ButtonLink href="/help#safety" variant="outline">{h.safetyTips}</ButtonLink>
        </Card>
        </Reveal>
      </section>

      {/* CTAs */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-20 sm:px-6 md:grid-cols-2">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep p-8 text-white">
          <AnimatedBackdrop />
          <h2 className="relative text-2xl font-bold">{h.ctaWorkerTitle}</h2>
          <p className="relative mt-2 text-white/80">{h.ctaWorkerText}</p>
          <ButtonLink href="/register" variant="gold" className="relative mt-6">
            {h.ctaWorkerButton} <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        <div className="relative overflow-hidden rounded-3xl border border-gold bg-gold-50 p-8">
          <AnimatedBackdrop tone="light" />
          <h2 className="relative text-2xl font-bold text-brand">{h.ctaEmployerTitle}</h2>
          <p className="relative mt-2 text-ink/80">{h.ctaEmployerText}</p>
          <ButtonLink href="/register?type=employer" className="relative mt-6">
            {h.ctaEmployerButton} <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>

      <SpotlightPopup items={spotlight} t={t.spotlight} />
    </>
  );
}

function StatTile({ icon, value, label }: { icon: ReactNode; value: number; label: string }) {
  return (
    <div className="group flex items-center gap-3 bg-card px-5 py-5 transition-colors hover:bg-brand-50/60">
      <span className="rounded-xl bg-brand-50 p-2.5 text-brand transition-transform group-hover:scale-110" aria-hidden="true">{icon}</span>
      <div>
        <p className="text-2xl font-bold text-ink">
          <CountUp value={value} />
        </p>
        <p className="text-xs text-muted">{label}</p>
      </div>
    </div>
  );
}

function SectionHeading({ eyebrow, title, subtitle, href, linkLabel }: { eyebrow: string; title: string; subtitle: string; href?: string; linkLabel?: string }) {
  return (
    <div className="mb-8 flex items-end justify-between gap-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-gold-600">{eyebrow}</p>
        <h2 className="mt-1 text-2xl font-bold text-ink sm:text-3xl">{title}</h2>
        <p className="mt-1 max-w-2xl text-sm text-muted">{subtitle}</p>
      </div>
      {href && linkLabel && (
        <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline sm:inline-flex">
          {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      )}
    </div>
  );
}

function HowColumn({ title, steps, icons }: { title: string; steps: string[]; icons: (typeof Search)[] }) {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-brand">{title}</h3>
      <ol className="relative mt-5 space-y-5 before:absolute before:bottom-5 before:left-5 before:top-5 before:w-px before:bg-gradient-to-b before:from-gold/60 before:to-transparent">
        {steps.map((text, i) => {
          const Icon = icons[i] ?? Star;
          return (
            <li key={i} className="flex gap-4">
              <span className="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-50 text-gold-600 ring-4 ring-card">
                <Icon className="h-5 w-5" aria-hidden="true" />
                <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-brand text-[10px] font-bold text-on-brand">{i + 1}</span>
              </span>
              <span className="pt-2 text-sm text-ink">{text}</span>
            </li>
          );
        })}
      </ol>
    </Card>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function HomePage() {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <HomePageContent />
    </Suspense>
  );
}
