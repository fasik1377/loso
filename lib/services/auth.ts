import "server-only";
import { db } from "@/lib/db";
import { AppError } from "@/lib/errors";
import { DUMMY_HASH, hashPassword, verifyPassword } from "@/lib/auth/password";
import { generateToken, hashToken } from "@/lib/auth/tokens";
import { normalizePhone } from "@/lib/phone";
import { slugify } from "@/lib/format";
import { getSettings } from "@/lib/settings";
import { audit } from "@/lib/audit";
import type { Role } from "@/lib/generated/prisma";
import type { z } from "zod";
import type { registerSchema } from "@/lib/validation/schemas";

type RegisterData = z.output<typeof registerSchema>;

const MAX_FAILED_LOGINS = 5;
const LOCK_MINUTES = 15;
const RESET_TTL_MS = 60 * 60 * 1000;

/**
 * Registration policy:
 *  - WORKER:   account PENDING; registration fee obligation created from current settings;
 *              must pay (staff-verified) AND pass document verification before activation.
 *  - CUSTOMER: ACTIVE immediately (no fee). Abuse is handled through reports + suspension.
 *  - EMPLOYER: account PENDING; must upload business documents and be verified + activated by
 *              an administrator before using Looso. The company starts as PENDING_REVIEW.
 * Staff roles are never assignable here.
 */
export async function registerUser(data: RegisterData): Promise<{ userId: string }> {
  const existing = await db.user.findFirst({
    where: { OR: [{ phone: data.phone }, ...(data.email ? [{ email: data.email }] : [])] },
    select: { phone: true },
  });
  if (existing) {
    throw new AppError(
      existing.phone === data.phone ? "An account with this phone number already exists." : "An account with this email already exists.",
      "CONFLICT",
    );
  }

  const passwordHash = await hashPassword(data.password);
  const settings = await getSettings();
  const roles: Role[] = [data.accountType];

  const user = await db.$transaction(async (tx) => {
    const u = await tx.user.create({
      data: {
        fullName: data.fullName,
        phone: data.phone,
        email: data.email ?? null,
        passwordHash,
        // Job seekers and employers need admin verification; only customers start active.
        status: data.accountType === "CUSTOMER" ? "ACTIVE" : "PENDING",
        activatedAt: data.accountType === "CUSTOMER" ? new Date() : null,
        roles: { create: roles.map((role) => ({ role })) },
        profile: { create: {} },
      },
    });

    if (data.accountType === "WORKER") {
      await tx.workerProfile.create({
        data: { userId: u.id, seeksJobs: data.seeksJobs, offersServices: data.offersServices },
      });
      await tx.registrationPayment.create({
        data: {
          userId: u.id,
          amountMinor: settings.registrationFeeMinor,
          currency: settings.registrationFeeCurrency,
          // A zero fee (fee disabled by the operator) is recorded as waived, not as "paid".
          status: settings.registrationFeeMinor === 0 ? "WAIVED" : "AWAITING_PAYMENT",
        },
      });
    }

    if (data.accountType === "EMPLOYER") {
      await tx.employerProfile.create({ data: { userId: u.id, employerType: data.employerType ?? "COMPANY" } });
      const base = slugify(data.companyName!) || "company";
      const company = await tx.company.create({
        data: {
          ownerId: u.id,
          name: data.companyName!,
          slug: `${base}-${u.id.slice(-6)}`,
          status: "PENDING_REVIEW",
        },
      });
      await tx.companyMember.create({ data: { companyId: company.id, userId: u.id, role: "OWNER" } });
    }

    await audit({ actorId: u.id, action: "user.register", entityType: "User", entityId: u.id, metadata: { accountType: data.accountType } }, tx);
    return u;
  });

  return { userId: user.id };
}

/** Returns the user id on success. Generic error messages avoid revealing which accounts exist. */
export async function authenticate(phoneOrEmail: string, password: string): Promise<string> {
  const phone = normalizePhone(phoneOrEmail);
  const user = await db.user.findFirst({
    where: phone ? { phone } : { email: phoneOrEmail.toLowerCase() },
  });
  const invalid = new AppError("Incorrect phone/email or password.", "UNAUTHORIZED");

  if (!user) {
    await verifyPassword(password, DUMMY_HASH); // equalize timing
    throw invalid;
  }
  if (user.lockedUntil && user.lockedUntil > new Date()) {
    throw new AppError("Too many failed attempts. Try again in a few minutes or reset your password.", "RATE_LIMITED");
  }
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    const failed = user.failedLogins + 1;
    await db.user.update({
      where: { id: user.id },
      data: {
        failedLogins: failed >= MAX_FAILED_LOGINS ? 0 : failed,
        lockedUntil: failed >= MAX_FAILED_LOGINS ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null,
      },
    });
    throw invalid;
  }
  // Pending/rejected/suspended users may sign in, but every protected feature checks status;
  // they only reach /account-status (pay, upload documents, read decisions).
  await db.user.update({ where: { id: user.id }, data: { failedLogins: 0, lockedUntil: null, lastLoginAt: new Date() } });
  return user.id;
}

/**
 * Creates a reset token. Delivery requires a configured SMS/email channel; until one exists,
 * staff can generate the link from the admin user page and hand it over through a verified channel.
 * Returns the raw token (caller decides how to deliver) or null when no such account exists.
 */
export async function createPasswordReset(phoneOrEmail: string): Promise<{ userId: string; token: string } | null> {
  const phone = normalizePhone(phoneOrEmail);
  const user = await db.user.findFirst({ where: phone ? { phone } : { email: phoneOrEmail.toLowerCase() }, select: { id: true } });
  if (!user) return null;
  const token = generateToken();
  await db.$transaction([
    db.passwordResetToken.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: new Date() } }),
    db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + RESET_TTL_MS) } }),
  ]);
  return { userId: user.id, token };
}

export async function resetPassword(token: string, newPassword: string): Promise<void> {
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) {
    throw new AppError("This reset link is invalid or has expired. Request a new one.");
  }
  const passwordHash = await hashPassword(newPassword);
  await db.$transaction([
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.user.update({ where: { id: record.userId }, data: { passwordHash, failedLogins: 0, lockedUntil: null } }),
    // Invalidate every existing session after a password reset.
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await audit({ actorId: record.userId, action: "user.password_reset", entityType: "User", entityId: record.userId });
}

export async function changePassword(userId: string, current: string, next: string): Promise<void> {
  const user = await db.user.findUniqueOrThrow({ where: { id: userId } });
  if (!(await verifyPassword(current, user.passwordHash))) throw new AppError("Your current password is incorrect.");
  await db.user.update({ where: { id: userId }, data: { passwordHash: await hashPassword(next) } });
}
