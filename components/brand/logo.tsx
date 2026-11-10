import Link from "next/link";

/**
 * Looso mark: a briefcase whose body carries a checkmark, i.e. "verified opportunity".
 * Pure SVG so it scales from favicon to footer without image assets.
 */
export function LogoMark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="30" height="30" rx="8" fill="#182B43" />
      <path d="M12 9.5V8.2c0-.7.6-1.2 1.2-1.2h5.6c.7 0 1.2.5 1.2 1.2v1.3" fill="none" stroke="#F4B942" strokeWidth="2" strokeLinecap="round" />
      <rect x="6.5" y="10" width="19" height="14" rx="2.5" fill="none" stroke="#FFFFFF" strokeWidth="2" />
      <path d="M11.5 17l3 3 6-6" fill="none" stroke="#F4B942" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ href = "/", tone = "dark", className = "" }: { href?: string; tone?: "dark" | "light"; className?: string }) {
  return (
    <Link href={href} className={`inline-flex items-center gap-2 ${className}`} aria-label="Looso home">
      <LogoMark />
      <span className={`text-xl font-bold tracking-tight ${tone === "dark" ? "text-brand" : "text-white"}`}>
        Looso
      </span>
    </Link>
  );
}
