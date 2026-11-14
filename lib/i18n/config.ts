/** Supported UI languages: English, Amharic and Sidaamu Afoo (Sidamigna, ISO 639-3 "sid"). */
export const LOCALES = ["en", "am", "sid"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "loso_locale";

export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "EN", name: "English" },
  am: { short: "አማ", name: "አማርኛ" },
  sid: { short: "SID", name: "Sidaamu Afoo" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}
