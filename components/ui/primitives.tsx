import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

type Variant = "primary" | "gold" | "outline" | "ghost" | "danger";
type Size = "sm" | "md" | "lg";

const variants: Record<Variant, string> = {
  primary: "bg-brand text-on-brand hover:bg-brand-700 disabled:bg-brand/50",
  gold: "bg-gold text-brand hover:bg-gold-600 disabled:bg-gold/50",
  outline: "border border-line bg-card text-ink hover:bg-canvas disabled:text-muted",
  ghost: "text-ink hover:bg-brand-50 disabled:text-muted",
  danger: "bg-danger text-white hover:bg-danger/90 disabled:bg-danger/50",
};
const sizes: Record<Size, string> = {
  sm: "h-8 px-3 text-sm",
  md: "h-10 px-4 text-sm",
  lg: "h-12 px-6 text-base",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra?: string) {
  return cx(
    "inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed",
    variants[variant],
    sizes[size],
    extra,
  );
}

export function Button({ variant = "primary", size = "md", className, ...props }: ComponentProps<"button"> & { variant?: Variant; size?: Size }) {
  return <button className={buttonClass(variant, size, className)} {...props} />;
}

export function ButtonLink({ variant = "primary", size = "md", className, ...props }: ComponentProps<typeof Link> & { variant?: Variant; size?: Size }) {
  return <Link className={buttonClass(variant, size, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("rounded-2xl border border-line bg-card shadow-[0_1px_2px_rgba(24,43,67,0.04)]", className)} {...props} />;
}

export function CardBody({ className, ...props }: ComponentProps<"div">) {
  return <div className={cx("p-4 sm:p-6", className)} {...props} />;
}

type Tone = "neutral" | "brand" | "gold" | "success" | "warning" | "danger";
const tones: Record<Tone, string> = {
  neutral: "bg-canvas text-muted ring-1 ring-line",
  brand: "bg-brand-50 text-brand",
  gold: "bg-gold-50 text-amber-800 dark:text-amber-300",
  success: "bg-success/10 text-success",
  warning: "bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300",
  danger: "bg-danger/10 text-danger",
};

export function Badge({ tone = "neutral", className, children }: { tone?: Tone; className?: string; children: ReactNode }) {
  return <span className={cx("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium", tones[tone], className)}>{children}</span>;
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold text-ink">{title}</h1>
        {description && <p className="mt-1 text-sm text-muted">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon?: ReactNode; title: string; description?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-xl border border-dashed border-line bg-card px-6 py-12 text-center">
      {icon && <div className="mb-3 text-muted">{icon}</div>}
      <p className="font-semibold text-ink">{title}</p>
      {description && <p className="mt-1 max-w-md text-sm text-muted">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Alert({ tone = "neutral", title, children }: { tone?: "neutral" | "success" | "warning" | "danger"; title?: string; children?: ReactNode }) {
  const map = {
    neutral: "border-line bg-card text-ink",
    success: "border-success/30 bg-success/10 text-success",
    warning: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200",
    danger: "border-danger/30 bg-danger/10 text-danger",
  };
  return (
    <div role={tone === "danger" ? "alert" : "status"} className={cx("rounded-lg border px-4 py-3 text-sm", map[tone])}>
      {title && <p className="font-semibold">{title}</p>}
      {children && <div className={title ? "mt-1" : ""}>{children}</div>}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("animate-pulse rounded-lg bg-slate-200/70", className)} aria-hidden="true" />;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <Card>
      <CardBody>
        <p className="text-sm text-muted">{label}</p>
        <p className="mt-1 text-2xl font-bold text-ink">{value}</p>
        {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
      </CardBody>
    </Card>
  );
}

export function Avatar({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) {
  const letters = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element -- served by our authorized file route
    <img src={src} alt="" width={size} height={size} className="shrink-0 rounded-full border border-line object-cover" style={{ width: size, height: size }} />
  ) : (
    <span aria-hidden="true" className="inline-flex shrink-0 items-center justify-center rounded-full bg-brand-50 font-semibold text-brand" style={{ width: size, height: size, fontSize: size / 2.6 }}>
      {letters}
    </span>
  );
}

export function Pagination({ page, pages, hrefFor }: { page: number; pages: number; hrefFor: (p: number) => string }) {
  if (pages <= 1) return null;
  return (
    <nav aria-label="Pagination" className="mt-6 flex items-center justify-center gap-2">
      {page > 1 ? <ButtonLink href={hrefFor(page - 1)} variant="outline" size="sm">Previous</ButtonLink> : null}
      <span className="px-2 text-sm text-muted">
        Page {page} of {pages}
      </span>
      {page < pages ? <ButtonLink href={hrefFor(page + 1)} variant="outline" size="sm">Next</ButtonLink> : null}
    </nav>
  );
}

export function Table({ children }: { children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-line bg-card">
      <table className="min-w-full divide-y divide-line text-sm [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:font-semibold [&_th]:text-muted [&_tbody_tr]:align-top">
        {children}
      </table>
    </div>
  );
}
