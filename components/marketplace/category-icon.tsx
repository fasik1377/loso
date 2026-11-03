import {
  Briefcase,
  Car,
  Footprints,
  Hammer,
  HardHat,
  Laptop,
  Paintbrush,
  Scissors,
  Sparkles,
  Sprout,
  Truck,
  Tv,
  Wrench,
  Zap,
  type LucideIcon,
} from "lucide-react";

/** Admin-selectable icons for service categories (stored by name in ServiceCategory.icon). */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  zap: Zap,
  wrench: Wrench,
  footprints: Footprints,
  "hard-hat": HardHat,
  hammer: Hammer,
  paintbrush: Paintbrush,
  sparkles: Sparkles,
  car: Car,
  tv: Tv,
  laptop: Laptop,
  scissors: Scissors,
  truck: Truck,
  sprout: Sprout,
  briefcase: Briefcase,
};

export function CategoryIcon({ name, className = "h-6 w-6" }: { name: string | null; className?: string }) {
  const Icon = (name && CATEGORY_ICONS[name]) || Briefcase;
  return <Icon className={className} aria-hidden="true" />;
}
