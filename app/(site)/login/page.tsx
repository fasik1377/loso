import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { BadgeCheck, Briefcase, Building2, Lock, MapPin, ShieldCheck, Sparkles, UserRound, Wrench } from "lucide-react";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { str } from "@/lib/search-params";
import { Alert, Card, CardBody } from "@/components/ui/primitives";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { PhotoDeck } from "@/components/marketplace/photo-deck";
import { LoginForm } from "./login-form";
import { getDictionary } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Sign in" };

const POINT_ICONS = [BadgeCheck, Lock, MapPin];
const ROLE_ICONS = [Wrench, UserRound, Building2, ShieldCheck];

async function LoginPageContent({ searchParams }: PageProps<"/login">) {
  await connection(); // live data: render per request
  const [user, sp, { t }] = await Promise.all([getCurrentUser(), searchParams, getDictionary()]);
  if (user) redirect(homePathFor(user));
  const a = t.auth;
  return (
    <div className="grid min-h-[calc(100vh-4rem)] lg:grid-cols-[1.05fr_1fr]">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand-deep text-white lg:block">
        <AnimatedBackdrop />
        <div className="relative flex h-full flex-col justify-between gap-10 px-10 py-12 xl:px-16">
          <div className="animate-fade-up">
            <p className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-gold ring-1 ring-white/15">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" /> Looso
            </p>
            <h2 className="mt-5 max-w-md text-4xl font-extrabold leading-tight tracking-tight">{a.panelTitle}</h2>
            <p className="mt-3 max-w-md text-white/70">{a.panelText}</p>
          </div>

          <div className="grid grid-cols-[minmax(0,15rem)_1fr] items-center gap-10">
            <PhotoDeck className="animate-fade-up [animation-delay:150ms]" />
            <ul className="space-y-4">
              {a.panelPoints.map((p, i) => {
                const Icon = POINT_ICONS[i] ?? BadgeCheck;
                return (
                  <li key={p} className="flex animate-fade-up items-center gap-3 text-sm text-white/85" style={{ animationDelay: `${250 + i * 120}ms` }}>
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/10 text-gold ring-1 ring-white/15">
                      <Icon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    {p}
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="animate-fade-up [animation-delay:500ms]">
            <p className="text-xs font-semibold uppercase tracking-wider text-white/50">{a.approvalTitle}</p>
            <ol className="mt-3 flex items-center gap-2 text-sm">
              {a.approvalSteps.map((s, i) => (
                <li key={s} className="flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold text-xs font-bold text-brand-deep">{i + 1}</span>
                  <span className="text-white/85">{s}</span>
                  {i < a.approvalSteps.length - 1 && <span className="mx-1 h-px w-8 bg-gradient-to-r from-gold/70 to-white/10" aria-hidden="true" />}
                </li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* Form */}
      <section className="relative flex items-center justify-center overflow-hidden px-4 py-12 sm:px-6">
        <AnimatedBackdrop tone="light" sparks={false} />
        <div className="relative w-full max-w-md">
          <div className="animate-fade-up">
            <p className="text-sm font-semibold text-gold-600">{a.welcomeBack}</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-ink">{a.signInTitle}</h1>
            <p className="mt-2 text-sm text-muted">{a.loginSubtitle}</p>
          </div>

          <div className="mt-5 flex animate-fade-up flex-wrap gap-2 [animation-delay:80ms]" aria-label={a.oneLogin}>
            {a.roles.map((r, i) => {
              const Icon = ROLE_ICONS[i] ?? Briefcase;
              return (
                <span key={r} className="inline-flex items-center gap-1.5 rounded-full border border-line bg-card px-3 py-1 text-xs font-medium text-ink shadow-sm">
                  <Icon className="h-3.5 w-3.5 text-brand" aria-hidden="true" /> {r}
                </span>
              );
            })}
          </div>

          {str(sp, "reset") && <div className="mt-5"><Alert tone="success">{a.resetDone}</Alert></div>}

          <Card className="mt-6 animate-fade-up shadow-xl shadow-brand/5 [animation-delay:160ms]">
            <CardBody className="p-6 sm:p-7">
              <LoginForm next={str(sp, "next", 200)} t={a} />
            </CardBody>
          </Card>

          <p className="mt-5 animate-fade-up text-center text-sm text-muted [animation-delay:240ms]">
            {a.newHere} <Link href="/register" className="font-semibold text-brand hover:underline">{a.createAccount}</Link>
          </p>
          <p className="mt-3 flex animate-fade-up items-center justify-center gap-1.5 text-center text-xs text-muted [animation-delay:300ms]">
            <ShieldCheck className="h-3.5 w-3.5 text-success" aria-hidden="true" /> {a.verificationNote}
          </p>
        </div>
      </section>
    </div>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function LoginPage(props: PageProps<"/login">) {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <LoginPageContent {...props} />
    </Suspense>
  );
}
