import type { FilePurpose } from "@/lib/generated/prisma";

export type AllowedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

const MB = 1024 * 1024;

/** Allowed types and size limits per upload purpose. */
export const UPLOAD_RULES: Record<FilePurpose, { mimes: AllowedMime[]; maxBytes: number; visibility: "PUBLIC" | "PRIVATE" }> = {
  AVATAR: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 2 * MB, visibility: "PUBLIC" },
  PORTFOLIO: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 4 * MB, visibility: "PUBLIC" },
  COMPANY_LOGO: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 2 * MB, visibility: "PUBLIC" },
  AD_BANNER: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 2 * MB, visibility: "PUBLIC" },
  CERTIFICATE: { mimes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: 5 * MB, visibility: "PRIVATE" },
  ID_DOCUMENT: { mimes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: 5 * MB, visibility: "PRIVATE" },
  COMPANY_DOCUMENT: { mimes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: 5 * MB, visibility: "PRIVATE" },
  PAYMENT_PROOF: { mimes: ["image/jpeg", "image/png", "application/pdf"], maxBytes: 5 * MB, visibility: "PRIVATE" },
  RESUME: { mimes: ["application/pdf"], maxBytes: 5 * MB, visibility: "PRIVATE" },
  SERVICE_REQUEST_PHOTO: { mimes: ["image/jpeg", "image/png", "image/webp"], maxBytes: 4 * MB, visibility: "PRIVATE" },
};

/**
 * Detect the real content type from magic bytes. The browser-supplied MIME type and file
 * extension are not trusted. SVG/HTML are intentionally unsupported (script execution risk).
 */
export function sniffMime(bytes: Uint8Array): AllowedMime | null {
  const b = bytes;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a && b[6] === 0x1a && b[7] === 0x0a) return "image/png";
  if (b.length >= 12 && String.fromCharCode(...b.slice(0, 4)) === "RIFF" && String.fromCharCode(...b.slice(8, 12)) === "WEBP") return "image/webp";
  if (b.length >= 5 && String.fromCharCode(...b.slice(0, 5)) === "%PDF-") return "application/pdf";
  return null;
}

export const EXTENSION: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

/** Strip path components and control characters from a user-supplied file name. */
export function safeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? "file";
  return base.replace(/[^\w.\- ]+/g, "_").slice(0, 120) || "file";
}
