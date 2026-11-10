"use client";

import Link from "next/link";
import { AnimatedBackdrop } from "@/components/ui/animated-backdrop";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import {
  BadgeCheck,
  Bell,
  Briefcase,
  Building2,
  ChartColumn,
  FileText,
  Flag,
  Home,
  Megaphone,
  Menu,
  MessageSquare,
  Plus,
  ScrollText,
  Search,
  Settings,
  Star,
  Tags,
  User,
  Users,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import { cx } from "@/components/ui/primitives";
import type { NavGroup } from "./nav-config";

const ICONS = {
  home: Home,
  user: User,
  briefcase: Briefcase,
  file: FileText,
  wrench: Wrench,
  star: Star,
  message: MessageSquare,
  bell: Bell,
  settings: Settings,
  search: Search,
  building: Building2,
  plus: Plus,
  users: Users,
  megaphone: Megaphone,
  chart: ChartColumn,
  badge: BadgeCheck,
  wallet: Wallet,
  flag: Flag,
  tags: Tags,
  scroll: ScrollText,
} as const;

/** Polls unread counts every 30s (basic polling — no realtime provider configured). */
function useCounts() {
  const [counts, setCounts] = useState({ messages: 0, notifications: 0 });
  useEffect(() => {
    let alive = true;
    const load = () =>
      fetch("/api/me/counts", { cache: "no-store" })
        .then((r) => (r.ok ? r.json() : null))
        .then((d) => alive && d && setCounts(d))
        .catch(() => undefined);
    load();
    const t = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);
  return counts;
}

export function Sidebar({ groups }: { groups: NavGroup[] }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const counts = useCounts();
  // Close the mobile drawer after navigation (state adjusted during render, not in an effect).
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  const isActive = (href: string) =>
    href === pathname || (href !== "/dashboard" && href !== "/admin" && href !== "/employer/dashboard" && pathname.startsWith(href + "/"));

  const nav = (
    <nav aria-label="Dashboard" className="space-y-6">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.title && <p className="mb-2 px-3 text-xs font-semibold uppercase tracking-wide text-white/50">{g.title}</p>}
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const Icon = ICONS[item.icon as keyof typeof ICONS] ?? Home;
              const count = item.badge ? counts[item.badge] : 0;
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    aria-current={isActive(item.href) ? "page" : undefined}
                    className={cx(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive(item.href) ? "bg-card/10 text-gold" : "text-white/85 hover:bg-card/5 hover:text-white",
                    )}
                  >
                    <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1">{item.label}</span>
                    {count > 0 && (
                      <span className="rounded-full bg-gold px-2 text-xs font-bold text-brand" aria-label={`${count} unread`}>
                        {count > 99 ? "99+" : count}
                      </span>
                    )}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 z-40 flex h-12 w-12 items-center justify-center rounded-full bg-brand text-on-brand shadow-lg lg:hidden"
        aria-label="Open navigation"
        aria-expanded={open}
      >
        <Menu className="h-6 w-6" />
      </button>
      <aside className="relative hidden w-64 shrink-0 overflow-hidden bg-brand-deep px-3 py-6 lg:block">
        <AnimatedBackdrop sparks={false} />
        <div className="relative">{nav}</div>
      </aside>
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Navigation">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <div className="absolute inset-y-0 left-0 w-72 overflow-y-auto bg-brand-deep px-3 py-6">
            <button type="button" onClick={() => setOpen(false)} className="mb-4 ml-auto flex rounded-lg p-2 text-white" aria-label="Close navigation">
              <X className="h-5 w-5" />
            </button>
            {nav}
          </div>
        </div>
      )}
    </>
  );
}
