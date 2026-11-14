import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Briefcase, LifeBuoy, Search, Wrench } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";

export const metadata: Metadata = { title: "Page not found" };

const LINKS = [
  { href: "/jobs", label: "Find jobs", icon: Briefcase },
  { href: "/services", label: "Find services", icon: Wrench },
  { href: "/how-it-works", label: "How it works", icon: Search },
  { href: "/support", label: "Get support", icon: LifeBuoy },
];

/** Shown for any address that does not exist on Looso. */
export default function NotFound() {
  return (
    <main id="main" className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-brand-deep px-4 py-16 text-center text-white">
      <AnimatedBackdrop />
      <div className="relative">
        <Logo tone="light" size="lg" className="mx-auto" />
        <p className="mt-10 font-display text-8xl font-extrabold tracking-tight text-gold sm:text-9xl">404</p>
        <h1 className="mt-2 font-display text-2xl font-bold sm:text-3xl">This page could not be found</h1>
        <p className="mx-auto mt-2 max-w-md text-white/70">The link may be old or mistyped. Here are some places to go instead.</p>
        <div className="mx-auto mt-8 grid max-w-lg gap-3 sm:grid-cols-2">
          {LINKS.map(({ href, label, icon: Icon }) => (
            <Link key={href} href={href} className="flex items-center gap-3 rounded-2xl bg-white/[0.07] px-4 py-3 text-left font-medium ring-1 ring-white/15 transition-colors hover:bg-white/15">
              <Icon className="h-5 w-5 text-gold" aria-hidden="true" /> {label}
            </Link>
          ))}
        </div>
        <Link href="/" className="mt-8 inline-flex items-center gap-2 text-sm font-semibold text-gold hover:underline">
          <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to the homepage
        </Link>
      </div>
    </main>
  );
}
