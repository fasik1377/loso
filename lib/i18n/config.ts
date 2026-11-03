/** Supported UI languages. Sidamu Afo can be added the same way (dictionary + entry here). */
export const LOCALES = ["en", "am"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "loso_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  am: { short: "አማ", name: "አማርኛ" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
