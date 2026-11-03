import Link from "next/link";
import { CategoryIcon } from "./category-icon";

/** Endless, slowly scrolling ribbon of service categories. Pauses on hover/focus; static with reduced motion. */
export function CategoryMarquee({ items, label }: { items: { slug: string; name: string; icon: string | null }[]; label: string }) {
  if (items.length === 0) return null;
  const loop = [...items, ...items]; // duplicated so the -50% translation loops seamlessly
  return (
    <nav aria-label={label} className="group relative overflow-hidden py-2 [mask-image:linear-gradient(90deg,transparent,black_8%,black_92%,transparent)]">
      <ul className="flex w-max animate-marquee gap-3 group-hover:[animation-play-state:paused] group-focus-within:[animation-play-state:paused]">
        {loop.map((c, i) => (
          <li key={`${c.slug}-${i}`} aria-hidden={i >= items.length ? true : undefined}>
            <Link
              href={`/services/${c.slug}`}
              tabIndex={i >= items.length ? -1 : undefined}
              className="inline-flex items-center gap-2 whitespace-nowrap rounded-full border border-line bg-card px-4 py-2 text-sm font-medium text-ink shadow-sm transition-colors hover:border-brand/40 hover:text-brand"
            >
              <CategoryIcon name={c.icon} className="h-4 w-4 text-gold-600" />
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
