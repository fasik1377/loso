import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { EXTENSION, UPLOAD_RULES, safeFileName, sniffMime } from "@/lib/domain/files";
import { hasPermission } from "@/lib/domain/permissions";
import type { FilePurpose } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import { storage } from "@/lib/storage";

/** Validate (size + magic bytes) and persist an uploaded file. Returns the StoredFile id. */
export async function saveUpload(file: File, purpose: FilePurpose, ownerId: string): Promise<string> {
  const rule = UPLOAD_RULES[purpose];
  if (file.size === 0) throw new AppError("The selected file is empty.");
  if (file.size > rule.maxBytes) throw new AppError(`File is too large. Maximum size is ${Math.round(rule.maxBytes / 1024 / 1024)} MB.`);
  const bytes = Buffer.from(await file.arrayBuffer());
  const mime = sniffMime(bytes);
  if (!mime || !rule.mimes.includes(mime)) {
    throw new AppError(`Unsupported file type. Allowed: ${rule.mimes.map((m) => EXTENSION[m].toUpperCase()).join(", ")}.`);
  }
  const key = `${purpose.toLowerCase()}/${ownerId}/${randomUUID()}.${EXTENSION[mime]}`;
  await storage().put(key, bytes, mime);
  const record = await db.storedFile.create({
    data: {
      ownerId,
      storageKey: key,
      originalName: safeFileName(file.name),
      mimeType: mime,
      sizeBytes: file.size,
      visibility: rule.visibility,
      purpose,
    },
  });
  return record.id;
}

/** Optional single file from FormData (empty inputs come through as a 0-byte File). */
export function formFile(form: FormData, name: string): File | null {
  const v = form.get(name);
  return v instanceof File && v.size > 0 ? v : null;
}

export function formFiles(form: FormData, name: string): File[] {
  return form.getAll(name).filter((v): v is File => v instanceof File && v.size > 0);
}

/**
 * Authorization for reading a stored file (prevents insecure direct object references).
 * Public files: anyone. Private files: owner, staff with the right permission, or a party with
 * a legitimate relationship (employer of a job the resume was submitted to, service participants).
 */
export async function canReadFile(user: SessionUser | null, fileId: string) {
  const file = await db.storedFile.findUnique({ where: { id: fileId } });
  if (!file) return null;
  if (file.visibility === "PUBLIC") {
    // Ad banners are public only once the ad is approved (or for owner/staff).
    if (file.purpose === "AD_BANNER") {
      const approved = await db.advertisement.count({ where: { imageFileId: file.id, status: "APPROVED" } });
      if (!approved && (!user || (user.id !== file.ownerId && !hasPermission(user.roles, "ads.manage")))) return null;
    }
    return file;
  }
  if (!user) return null;
  if (user.id === file.ownerId) return file;

  switch (file.purpose) {
    case "ID_DOCUMENT":
    case "CERTIFICATE":
    case "COMPANY_DOCUMENT":
      return hasPermission(user.roles, "verifications.review") ? file : null;
    case "PAYMENT_PROOF":
      return hasPermission(user.roles, "payments.review") ? file : null;
    case "RESUME": {
      if (user.status !== "ACTIVE") return null;
      const viaApplication = await db.jobApplication.count({
        where: {
          resume: { fileId: file.id },
          job: { company: { OR: [{ ownerId: user.id }, { members: { some: { userId: user.id } } }] } },
        },
      });
      return viaApplication > 0 || hasPermission(user.roles, "content.moderate") ? file : null;
    }
    case "SERVICE_REQUEST_PHOTO": {
      const viaRequest = await db.serviceRequestAttachment.count({
        where: { fileId: file.id, request: { OR: [{ customerId: user.id }, { workerId: user.id }] } },
      });
      return viaRequest > 0 || hasPermission(user.roles, "content.moderate") ? file : null;
    }
    default:
      return null;
  }
}

export function fileUrl(fileId: string | null | undefined): string | null {
  return fileId ? `/api/files/${fileId}` : null;
}
