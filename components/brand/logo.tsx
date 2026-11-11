import Image from "next/image";
import Link from "next/link";
import logoAmber from "@/public/images/brand/logo-amber.png";
import logoNavy from "@/public/images/brand/logo-navy.png";

const SIZES = {
  sm: "h-9", // dashboard bar
  md: "h-11 sm:h-12", // site header
  lg: "h-14", // footer
  xl: "h-20 sm:h-24", // sign-in page
} as const;

/**
 * The Looso logo (from the brand files in /public/images, trimmed with a transparent background).
 *  - tone "auto": for page-coloured surfaces. Navy in light theme, amber in dark theme.
 *  - tone "light": for navy surfaces (hero, footer, sidebar). Always amber.
 */
export function Logo({
  href = "/",
  tone = "auto",
  size = "md",
  className = "",
  priority = false,
}: {
  href?: string | null;
  tone?: "auto" | "light";
  size?: keyof typeof SIZES;
  className?: string;
  priority?: boolean;
}) {
  const h = SIZES[size];
  const img =
    tone === "light" ? (
      <Image src={logoAmber} alt="Looso" preload={priority} className={`${h} w-auto`} />
    ) : (
      <>
        <Image src={logoNavy} alt="Looso" preload={priority} className={`${h} w-auto dark:hidden`} />
        <Image src={logoAmber} alt="" aria-hidden="true" className={`${h} hidden w-auto dark:block`} />
      </>
    );
  if (href === null) return <span className={`inline-flex items-center ${className}`}>{img}</span>;
  return (
    <Link href={href} className={`inline-flex shrink-0 items-center ${className}`} aria-label="Looso home">
      {img}
    </Link>
  );
}
