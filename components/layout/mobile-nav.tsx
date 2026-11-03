"use client";

import Link from "next/link";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { buttonClass } from "@/components/ui/primitives";

export function MobileNav({ items, signedIn, dashboardHref }: { items: { href: string; label: string }[]; signedIn: boolean; dashboardHref: string | null }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="md:hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="rounded-lg p-2 text-ink hover:bg-brand-50"
        aria-expanded={open}
        aria-controls="mobile-menu"
        aria-label={open ? "Close menu" : "Open menu"}
      >
        {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
      </button>
      {open && (
        <div id="mobile-menu" className="absolute inset-x-0 top-16 border-b border-line bg-white px-4 pb-4 shadow-sm">
          <nav aria-label="Mobile" className="flex flex-col py-2">
            {items.map((n) => (
              <Link key={n.href} href={n.href} onClick={() => setOpen(false)} className="rounded-lg px-3 py-3 font-medium text-ink hover:bg-brand-50">
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex gap-2">
            {signedIn && dashboardHref ? (
              <Link href={dashboardHref} className={buttonClass("primary", "md", "flex-1")} onClick={() => setOpen(false)}>Dashboard</Link>
            ) : (
              <>
                <Link href="/login" className={buttonClass("outline", "md", "flex-1")} onClick={() => setOpen(false)}>Sign in</Link>
                <Link href="/register" className={buttonClass("gold", "md", "flex-1")} onClick={() => setOpen(false)}>Join Loso</Link>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
