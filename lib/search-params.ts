/** Helpers for reading Next.js searchParams safely. */
export type SP = Record<string, string | string[] | undefined>;

export function str(sp: SP, key: string, max = 100): string | undefined {
  const v = sp[key];
  const s = Array.isArray(v) ? v[0] : v;
  const t = s?.trim().slice(0, max);
  return t ? t : undefined;
}

export function int(sp: SP, key: string): number | undefined {
  const s = str(sp, key, 12);
  const n = s ? Number.parseInt(s, 10) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function buildQuery(sp: SP, overrides: Record<string, string | number | undefined>): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(sp)) {
    const s = Array.isArray(v) ? v[0] : v;
    if (s) q.set(k, s);
  }
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined || v === "") q.delete(k);
    else q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}
