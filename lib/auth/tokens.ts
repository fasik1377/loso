import { createHash, randomBytes } from "node:crypto";

/** 256-bit random token, URL-safe. The raw value is only ever given to the user. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Tokens are stored hashed, so a database leak does not leak usable sessions/reset links. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
