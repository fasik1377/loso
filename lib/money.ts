import { marketConfig } from "./config";

/** Money is always stored as integer minor units (santim for ETB). Never use floats for storage. */
export function toMinorUnits(major: number | string): number {
  const value = typeof major === "string" ? Number(major) : major;
  if (!Number.isFinite(value) || value < 0) throw new Error("Invalid amount");
  return Math.round(value * marketConfig.currencyMinorUnits);
}

export function formatMoney(minor: number, currency: string = marketConfig.currency): string {
  const major = minor / marketConfig.currencyMinorUnits;
  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: Number.isInteger(major) ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(major);
  return `${currency} ${formatted}`;
}

export function formatRange(min: number | null, max: number | null, currency?: string): string | null {
  if (min == null && max == null) return null;
  if (min != null && max != null && min !== max) return `${formatMoney(min, currency)} – ${formatMoney(max, currency).replace(/^\S+ /, "")}`;
  return formatMoney((min ?? max)!, currency);
}
