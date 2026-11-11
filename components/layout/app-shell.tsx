import Link from "next/link";
import { Suspense, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Skeleton } from "@/components/ui/primitives";
import { requireActivePage } from "@/lib/auth/guards";
import { logoutAction } from "@/lib/actions/auth";
import { navFor } from "./nav-config";
import { ThemeToggle } from "./theme-toggle";
import { getDictionary } from "@/lib/i18n/server";
import { Sidebar } from "./sidebar";

async function Shell({ children }: { children: ReactNode }) {
  // Pending / rejected / suspended accounts never see the dashboard shell.
  const [user, { t }] = await Promise.all([requireActivePage(), getDictionary()]);
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-line bg-card px-4 sm:px-6">
        <Logo size="sm" />
        <div className="flex items-center gap-3 text-sm">
          <Link href="/" className="hidden text-muted hover:text-ink sm:inline">Back to site</Link>
          <ThemeToggle labels={t.theme} />
          <span className="hidden font-medium text-ink sm:inline">{user.fullName}</span>
          <form action={logoutAction}>
            <button className="rounded-lg border border-line px-3 py-1.5 text-muted hover:text-ink">Sign out</button>
          </form>
        </div>
      </header>
      <div className="flex flex-1">
        <Sidebar groups={navFor(user.roles)} />
        <main id="main" className="min-w-0 flex-1 px-4 py-6 sm:px-8">
          {children}
        </main>
      </div>
    </div>
  );
}

function ShellSkeleton() {
  return (
    <div className="flex min-h-screen flex-col">
      <div className="h-14 border-b border-line bg-card" />
      <div className="flex flex-1">
        <div className="hidden w-64 bg-brand-deep lg:block" />
        <div className="flex-1 space-y-4 p-8">
          <Skeleton className="h-8 w-56" />
          <Skeleton className="h-32" />
          <Skeleton className="h-32" />
        </div>
      </div>
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <Shell>{children}</Shell>
    </Suspense>
  );
}
