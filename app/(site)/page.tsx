import Link from "next/link";
import { connection } from "next/server";
import { ArrowRight, BadgeCheck, Briefcase, CheckCircle2, Flag, Lock, MessageSquare, Search, ShieldCheck, Star, UserPlus } from "lucide-react";
import { db } from "@/lib/db";
import { marketConfig } from "@/lib/config";
import { publicJobWhere, jobCompanySelect } from "@/lib/services/jobs";
import { publicWorkerWhere, workerUserSelect } from "@/lib/services/workers";
import { areaLocations, jobCategories, serviceCategories } from "@/lib/services/taxonomy";
import { ButtonLink, Card, EmptyState } from "@/components/ui/primitives";
import { HeroSearch } from "@/components/marketplace/hero-search";
import { CategoryIcon } from "@/components/marketplace/category-icon";
import { JobCard, WorkerCard } from "@/components/marketplace/cards";
import { AdSlot } from "@/components/marketplace/ad-slot";

export default async function HomePage() {
  await connection(); // always render with live data
  const [services, jobCats, locations, jobs, workers] = await Promise.all([
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
  ]);

  return (
    <>
      {/* Hero */}
      <section className="bg-brand">
        <div className="mx-auto max-w-7xl px-4 pb-14 pt-12 sm:px-6 md:pb-20 md:pt-16">
          <p className="text-sm font-semibold uppercase tracking-wider text-gold">{marketConfig.tagline}</p>
          <h1 className="mt-3 max-w-3xl text-3xl font-bold leading-tight text-white sm:text-5xl">
            Find Skilled Workers. Discover Jobs. Grow Your Future.
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-white/80">{marketConfig.supportingMessage}</p>
          <div className="mt-8 max-w-5xl">
            <HeroSearch
              locations={locations.map((l) => ({ value: l.slug, label: l.name }))}
              serviceCategories={services.map((c) => ({ value: c.slug, label: c.name }))}
              jobCategories={jobCats.map((c) => ({ value: c.slug, label: c.name }))}
            />
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHeading title="Popular services" subtitle="Trusted local professionals for everyday needs." href="/services" linkLabel="All services" />
        {services.length === 0 ? (
          <EmptyState title="No service categories yet" description="Administrators can add categories from the admin dashboard." />
        ) : (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {services.slice(0, 10).map((c) => (
              <Link key={c.id} href={`/services/${c.slug}`} className="group flex flex-col items-center gap-2 rounded-xl border border-line bg-white p-4 text-center transition-colors hover:border-brand">
                <span className="rounded-full bg-brand-50 p-3 text-brand group-hover:bg-brand group-hover:text-gold">
                  <CategoryIcon name={c.icon} />
                </span>
                <span className="text-sm font-medium text-ink">{c.name}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        <AdSlot slot="HOME" />
      </div>

      {/* Jobs */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <SectionHeading title="Latest job opportunities" subtitle="Open vacancies from employers in Hawassa." href="/jobs" linkLabel="Browse all jobs" />
        {jobs.length === 0 ? (
          <EmptyState icon={<Briefcase className="h-8 w-8" />} title="No open jobs right now" description="New vacancies appear here as soon as employers publish them." action={<ButtonLink href="/register?type=employer" variant="outline">Post a job</ButtonLink>} />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {jobs.map((j) => (
              <JobCard key={j.id} job={j} />
            ))}
          </div>
        )}
      </section>

      {/* Workers */}
      <section className="bg-white py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <SectionHeading title="Skilled workers near you" subtitle="Ranked by real customer reviews and completed jobs on Loso." href="/services" linkLabel="Find more workers" />
          {workers.length === 0 ? (
            <EmptyState title="No service providers listed yet" description="Approved workers will appear here." action={<ButtonLink href="/register" variant="outline">Offer your services</ButtonLink>} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {workers.map((w) => (
                <WorkerCard key={w.id} worker={w} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="mx-auto max-w-7xl scroll-mt-20 px-4 py-14 sm:px-6">
        <h2 className="text-2xl font-bold text-ink">How Loso works</h2>
        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <HowColumn
            title="For workers & job seekers"
            steps={[
              { icon: UserPlus, text: "Register, pay the registration fee and upload your ID." },
              { icon: BadgeCheck, text: "Our team verifies your payment and documents, then activates your account." },
              { icon: Search, text: "Apply for jobs and receive service requests from customers." },
              { icon: Star, text: "Complete work, earn reviews and grow your reputation." },
            ]}
          />
          <HowColumn
            title="For customers & employers"
            steps={[
              { icon: Search, text: "Search workers by service, area and rating — or post a job vacancy." },
              { icon: MessageSquare, text: "Send a service request or review applicants and chat in Loso." },
              { icon: CheckCircle2, text: "Track progress and confirm when the work is done." },
              { icon: Star, text: "Leave an honest review for completed services." },
            ]}
          />
        </div>
      </section>

      {/* Benefits */}
      <section className="bg-white py-14">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-3">
          {[
            { title: "Verified people", text: "Workers are activated only after staff check their payment and identity documents.", icon: ShieldCheck },
            { title: "Honest reviews", text: "Only customers with a completed service request can leave a review — one per job.", icon: Star },
            { title: "Private by default", text: "Phone numbers stay hidden unless the owner allows it. Chat safely inside Loso.", icon: Lock },
          ].map((b) => (
            <Card key={b.title} className="p-6">
              <b.icon className="h-8 w-8 text-gold-600" aria-hidden="true" />
              <h3 className="mt-3 font-semibold text-ink">{b.title}</h3>
              <p className="mt-1 text-sm text-muted">{b.text}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Trust & safety */}
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <Card className="flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
          <div className="flex gap-4">
            <Flag className="mt-1 h-6 w-6 shrink-0 text-danger" aria-hidden="true" />
            <div>
              <h2 className="text-lg font-semibold text-ink">Trust & safety</h2>
              <p className="mt-1 max-w-2xl text-sm text-muted">
                Never pay anyone outside an agreed service, never share your password, and report suspicious profiles, jobs or messages. Our moderators review every report.
              </p>
            </div>
          </div>
          <ButtonLink href="/help#safety" variant="outline">Safety tips</ButtonLink>
        </Card>
      </section>

      {/* CTAs */}
      <section className="mx-auto grid max-w-7xl gap-4 px-4 pb-16 sm:px-6 md:grid-cols-2">
        <div className="rounded-2xl bg-brand p-8 text-white">
          <h2 className="text-2xl font-bold">Ready to offer your skills?</h2>
          <p className="mt-2 text-white/80">Create a worker profile, get verified and start receiving opportunities.</p>
          <ButtonLink href="/register" variant="gold" className="mt-6">
            Register as a worker <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
        <div className="rounded-2xl border border-gold bg-gold-50 p-8">
          <h2 className="text-2xl font-bold text-brand">Hiring in Hawassa?</h2>
          <p className="mt-2 text-ink/80">Create a company profile, publish vacancies and manage applicants in one place.</p>
          <ButtonLink href="/register?type=employer" className="mt-6">
            Register as an employer <ArrowRight className="h-4 w-4" />
          </ButtonLink>
        </div>
      </section>
    </>
  );
}

function SectionHeading({ title, subtitle, href, linkLabel }: { title: string; subtitle: string; href: string; linkLabel: string }) {
  return (
    <div className="mb-6 flex items-end justify-between gap-4">
      <div>
        <h2 className="text-2xl font-bold text-ink">{title}</h2>
        <p className="mt-1 text-sm text-muted">{subtitle}</p>
      </div>
      <Link href={href} className="hidden shrink-0 items-center gap-1 text-sm font-semibold text-brand hover:underline sm:inline-flex">
        {linkLabel} <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}

function HowColumn({ title, steps }: { title: string; steps: { icon: typeof Search; text: string }[] }) {
  return (
    <Card className="p-6">
      <h3 className="font-semibold text-brand">{title}</h3>
      <ol className="mt-4 space-y-4">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold-50 text-gold-600">
              <s.icon className="h-5 w-5" aria-hidden="true" />
            </span>
            <span className="pt-1.5 text-sm text-ink">
              <span className="font-semibold">{i + 1}.</span> {s.text}
            </span>
          </li>
        ))}
      </ol>
    </Card>
  );
}
