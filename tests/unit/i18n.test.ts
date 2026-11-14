import { describe, expect, it } from "vitest";
import { en } from "@/lib/i18n/dictionaries/en";
import { am } from "@/lib/i18n/dictionaries/am";
import { sid } from "@/lib/i18n/dictionaries/sid";
import { LOCALES, LOCALE_LABELS, isLocale } from "@/lib/i18n/config";

/** Collect every leaf path → value so languages can be compared structurally. */
function leaves(obj: unknown, prefix = ""): Map<string, unknown> {
  const out = new Map<string, unknown>();
  if (Array.isArray(obj)) obj.forEach((v, i) => leaves(v, `${prefix}[${i}]`).forEach((val, k) => out.set(k, val)));
  else if (obj && typeof obj === "object") for (const [k, v] of Object.entries(obj)) leaves(v, prefix ? `${prefix}.${k}` : k).forEach((val, key) => out.set(key, val));
  else out.set(prefix, obj);
  return out;
}

const enLeaves = leaves(en);

describe.each([
  ["Amharic", am],
  ["Sidaamu Afoo", sid],
])("%s dictionary", (_name, dict) => {
  const dictLeaves = leaves(dict);

  it("has exactly the same keys (and list lengths) as English, with no empty strings", () => {
    const missing = [...enLeaves.keys()].filter((k) => !dictLeaves.has(k));
    const extra = [...dictLeaves.keys()].filter((k) => !enLeaves.has(k));
    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
    for (const [k, v] of dictLeaves) expect(v, k).not.toBe("");
  });

  it("keeps the support topic keys identical (they are used in URLs)", () => {
    expect(dict.support.topics.map((t) => t.key)).toEqual(en.support.topics.map((t) => t.key));
  });
});

describe("Amharic dictionary", () => {
  it("is actually written in Ge'ez script", () => {
    const amLeaves = leaves(am);
    const ethiopic = /[ሀ-፿]/;
    const translated = [...amLeaves.values()].filter((v) => typeof v === "string" && ethiopic.test(v));
    expect(translated.length / amLeaves.size).toBeGreaterThan(0.95);
  });
});

describe("Sidaamu Afoo dictionary", () => {
  it("is translated, not a copy of English", () => {
    const sidLeaves = leaves(sid);
    // Values that are legitimately identical in every language (brand, number formats, URL keys…).
    const same = [...sidLeaves].filter(([k, v]) => typeof v === "string" && v === enLeaves.get(k) && !/\.key$/.test(k));
    expect(same.length / sidLeaves.size).toBeLessThan(0.05);
  });
});

describe("locales", () => {
  it("offers English, Amharic and Sidaamu Afoo with labels", () => {
    expect([...LOCALES]).toEqual(["en", "am", "sid"]);
    for (const l of LOCALES) expect(LOCALE_LABELS[l].name.length).toBeGreaterThan(0);
  });

  it("only accepts supported locale codes", () => {
    expect(isLocale("am")).toBe(true);
    expect(isLocale("en")).toBe(true);
    expect(isLocale("sid")).toBe(true);
    expect(isLocale("fr")).toBe(false);
    expect(isLocale("am; drop")).toBe(false);
  });
});
