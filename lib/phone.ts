import { marketConfig } from "./config";

/**
 * Normalize an Ethiopian phone number to E.164 (+2519XXXXXXXX).
 * Accepts "0911 23 45 67", "911234567", "251911234567", "+251-911-234-567".
 * Returns null when the input cannot be a valid number.
 */
export function normalizePhone(input: string): string | null {
  const { countryCode, nsnLength, validPrefixes } = marketConfig.phone;
  let digits = input.replace(/[\s\-().]/g, "");
  if (digits.startsWith("+")) digits = digits.slice(1);
  else if (digits.startsWith("00")) digits = digits.slice(2);
  if (!/^\d+$/.test(digits)) return null;

  let nsn: string;
  if (digits.startsWith(countryCode)) nsn = digits.slice(countryCode.length);
  else if (digits.startsWith("0")) nsn = digits.slice(1);
  else nsn = digits;

  if (nsn.length !== nsnLength || !validPrefixes.test(nsn)) return null;
  return `+${countryCode}${nsn}`;
}

/** "+251911234567" -> "+251 91 123 4567" */
export function formatPhone(e164: string): string {
  const m = /^\+(\d{3})(\d{2})(\d{3})(\d{4})$/.exec(e164);
  return m ? `+${m[1]} ${m[2]} ${m[3]} ${m[4]}` : e164;
}
