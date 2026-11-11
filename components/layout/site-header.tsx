import Link from "next/link";
import { Suspense } from "react";
import { Bell } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { ButtonLink, Skeleton } from "@/components/ui/primitives";
import { getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { logoutAction } from "@/lib/actions/auth";
import { getDictionary } from "@/lib/i18n/server";
import { LanguageSwitcher } from "./language-switcher";
import { ThemeToggle } from "./theme-toggle";
import { MobileNav } from "./mobile-nav";

async function HeaderContent() {
  const [{ locale, t }, user] = await Promise.all([getDictionary(), getCurrentUser()]);
  const nav = [
    { href: "/jobs", label: t.nav.findJobs },
    { href: "/services", label: t.nav.findServices },
    { href: "/#how-it-works", label: t.nav.howItWorks },
    { href: "/help", label: t.nav.help },
  ];
  const unread = user?.status === "ACTIVE" ? await db.notification.count({ where: { userId: user.id, readAt: null } }) : 0;
  const dashboardHref = user ? homePathFor(user) : null;

  return (
    <>
      <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
        {nav.map((n) => (
          <Link key={n.href} href={n.href} className="rounded-lg px-3 py-2 text-sm font-medium text-ink transition-colors hover:bg-brand-50 hover:text-brand">
            {n.label}
          </Link>
        ))}
      </nav>
      <div className="hidden items-center gap-2 md:flex">
        <LanguageSwitcher locale={locale} label={t.language.label} />
        <ThemeToggle labels={t.theme} />
        {user ? (
          <>
            {user.status === "ACTIVE" && (
              <Link href="/dashboard/notifications" className="relative rounded-lg p-2 text-ink hover:bg-brand-50" aria-label={`${t.nav.notifications}${unread ? ` (${unread})` : ""}`}>
                <Bell className="h-5 w-5" aria-hidden="true" />
                {unread > 0 && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-gold" />}
              </Link>
            )}
            <ButtonLink href={dashboardHref!} variant="primary">{t.nav.dashboard}</ButtonLink>
            <form action={logoutAction}>
              <button className="rounded-lg px-3 py-2 text-sm text-muted hover:text-ink">{t.nav.signOut}</button>
            </form>
          </>
        ) : (
          <>
            <ButtonLink href="/login" variant="ghost">{t.nav.signIn}</ButtonLink>
            <ButtonLink href="/register" variant="gold">{t.nav.join}</ButtonLink>
          </>
        )}
      </div>
      <MobileNav
        items={nav}
        signedIn={!!user}
        dashboardHref={dashboardHref}
        locale={locale}
        labels={{ signIn: t.nav.signIn, join: t.nav.join, dashboard: t.nav.dashboard, open: t.nav.openMenu, close: t.nav.closeMenu, language: t.language.label }}
        themeLabels={t.theme}
      />
    </>
  );
}

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-line bg-card/90 backdrop-blur-md">
      <div className="mx-auto flex h-[4.5rem] max-w-7xl items-center justify-between gap-4 px-4 sm:px-6">
        <Logo priority />
        <Suspense fallback={<Skeleton className="h-10 w-48" />}>
          <HeaderContent />
        </Suspense>
      </div>
    </header>
  );
}
