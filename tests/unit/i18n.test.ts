import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { am } from "@/lib/i18n/dictionaries/am";
import { isLocale } from "@/lib/i18n/config";

/** Collect every leaf path → value so both languages can be compared structurally. */
function leaves(obj: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (Array.isArray(obj)) obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`).forEach((val, k) => out.set(k, val)));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) leaves(v, prefix ? `${prefix}.${k}` : k).forEach((val, key) => out.set(key, val));
  else out.set(prefix, obj);
  return out;
}

describe("Amharic dictionary", () => {
  const enLeaves = leaves(en);
  const amLeaves = leaves(am);

  it("has exactly the same keys (and list lengths) as English", () => {
    const allowedEmpty = new Set(["hero.lookingFor"]); // Amharic puts the verb inside the rotating phrase
    const missing = [...enLeaves.keys()].filter((k) => !amLeaves.has(k));
    const extra = [...amLeaves.keys()].filter((k) => !enLeaves.has(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    for (const [k, v] of amLeaves) if (!allowedEmpty.has(k)) expect(v, k).not.toBe("");
  });

  it("is actually written in Ge'ez script", () => {
    const ethiopic = /[\u1200-\u137F]/;
    const translated = [...amLeaves.values()].filter((v) => typeof v === "string" && ethiopic.test(v));
    expect(translated.length / amLeaves.size).toBeGreaterThan(0.95);
  });

  it("only accepts supported locale codes", () => {
    expect(isLocale("am")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("am; drop")).toBe(false);
  });
});
