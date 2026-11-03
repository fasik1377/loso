import "server-only";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, type Locale } from "./config";
import { en, type Dictionary } from "./dictionaries/en";
import { am } from "./dictionaries/am";

const DICTIONARIES: Record<Locale, Dictionary> = { en, am };

/** The visitor's chosen language (cookie), falling back to English. */
export async function getLocale(): Promise<Locale> {
  const value = (await cookies()).get(LOCALE_COOKIE)?.value;
  return isLocale(value) ? value : DEFAULT_LOCALE;
}

export async function getDictionary(): Promise<{ locale: Locale; t: Dictionary }> {
  const locale = await getLocale();
  return { locale, t: DICTIONARIES[locale] };
}
