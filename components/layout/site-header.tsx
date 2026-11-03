import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink, Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/actions/auth";
import { MobileNav } from "./mobile-nav";

const NAV = [
  { href: "/jobs", label: "Find jobs" },
  { href: "/services", label: "Find services" },
  { href: "/#how-it-works", label: "How it works" },
  { href: "/help", label: "Help" },
];

async function UserArea() {
  const user = await getCurrentUser();
  if (!user) {
    return (
      <div className="hidden items-center gap-2 md:flex">
        <ButtonLink href="/login" variant="ghost">Sign in</ButtonLink>
        <ButtonLink href="/register" variant="gold">Join Loso</ButtonLink>
      </div>
    );
  }
  const unread = user.status === "ACTIVE" ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  return (
    <div className="hidden items-center gap-2 md:flex">
      {user.status === "ACTIVE" && (
        <Link href="/dashboard/notifications" className="relative rounded-lg p-2 text-ink hover:bg-brand-50" aria-label={`Notifications${unread ? `, ${unread} unread` : ""}`}>
          <Bell className="h-5 w-5" aria-hidden="true" />
          {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />}
        </Link>
      )}
      <ButtonLink href={homePathFor(user)} variant="primary">Dashboard</ButtonLink>
      <form action={logoutAction}>
        <button className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">Sign out</button>
      </form>
    </div>
  );
}

async function MobileUserNav() {
  const user = await getCurrentUser();
  return <MobileNav items={NAV} signedIn={!!user} dashboardHref={user ? homePathFor(user) : null} />;
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo />
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink hover:bg-brand-50 hover:text-brand">
              {n.label}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<Skeleton className="hidden h-10 w-48 md:block" />}>
          <UserArea />
        </Suspense>
        <Suspense fallback={<Skeleton className="h-10 w-10 md:hidden" />}>
          <MobileUserNav />
        </Suspense>
      </div>
    </header>
  );
}
