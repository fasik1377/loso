/**
 * Market/locale configuration. Business logic reads these values instead of hardcoding
 * city, currency or phone formats so another Ethiopian city (or locale) can be added later.
 */
export const marketConfig = {
  appName: "Looso",
  tagline: "Every Skill Has Value.",
  supportingMessage: "Connecting people, skills, and opportunities across Hawassa.",
  defaultCity: process.env.LOSO_DEFAULT_CITY ?? "Hawassa",
  region: "Sidama, Ethiopia",
  currency: "ETB",
  /** Currency minor units per major unit (1 Birr = 100 santim). */
  currencyMinorUnits: 100,
  locale: "en-ET",
  supportedLocales: ["en", "am"] as const,
  plannedLocales: ["sid"] as const,
  phone: {
    countryCode: "251",
    /** National significant number length (without the trunk 0). */
    nsnLength: 9,
    /** Mobile (9x, 7x) and fixed-line (1x-5x) prefixes accepted. */
    validPrefixes: /^[1-579]/,
  },
} as const;

export const appUrl = process.env.APP_URL ?? "http://localhost:3000";
