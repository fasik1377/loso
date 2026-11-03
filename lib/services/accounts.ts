import "server-only";
import { randomUUID } from "node:crypto";
import { db } from "@/lib/db";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { canActivate, deriveAccountStage, type AccountSnapshot } from "@/lib/domain/account";
import { canAssignRole } from "@/lib/domain/permissions";
import type { DocumentKind, Role } from "@/lib/generated/prisma";
import { manualProvider } from "@/lib/payments/providers";
import type { SessionUser } from "@/lib/auth/session";
import { destroyAllSessions } from "@/lib/auth/session";

export async function getAccountSnapshot(userId: string) {
  const user = await db.user.findUniqueOrThrow({
    where: { id: userId },
    include: {
      roles: true,
      registrationPayments: { include: { transactions: { orderBy: { createdAt: "desc" } } } },
      verifications: { orderBy: { createdAt: "desc" }, take: 1, include: { documents: { include: { file: true } } } },
    },
  });
  const payment = user.registrationPayments[0] ?? null;
  const verification = user.verifications[0] ?? null;
  const snapshot: AccountSnapshot = {
    status: user.status,
    roles: user.roles.map((r) => r.role),
    payment: payment ? { status: payment.status } : null,
    verification: verification ? { status: verification.status } : null,
  };
  return { user, payment, verification, snapshot, stage: deriveAccountStage(snapshot) };
}

// ─── Payments ────────────────────────────────────────────────────────────────

/**
 * Worker submits a manual payment reference. Idempotent per (provider, reference): the same
 * reference can never be claimed twice, by this or any other user.
 */
export async function submitManualPayment(
  userId: string,
  input: { method: string; reference: string; proofFileId: string | null },
): Promise<void> {
  const payment = await db.registrationPayment.findUnique({ where: { userId } });
  if (!payment) throw notFound("No registration fee is due for this account.");
  if (payment.status === "VERIFIED" || payment.status === "WAIVED") throw conflict("Your registration payment is already confirmed.");
  if (payment.status === "UNDER_REVIEW") throw conflict("Your payment is already under review.");

  const reference = input.reference.toUpperCase();
  const duplicate = await db.paymentTransaction.findUnique({
    where: { provider_providerReference: { provider: manualProvider.id, providerReference: reference } },
  });
  if (duplicate) throw conflict("This transaction reference has already been submitted.");

  await db.$transaction(async (tx) => {
    await tx.paymentTransaction.create({
      data: {
        userId,
        purpose: "REGISTRATION",
        registrationPaymentId: payment.id,
        provider: manualProvider.id,
        method: input.method,
        idempotencyKey: randomUUID(),
        providerReference: reference,
        amountMinor: payment.amountMinor,
        currency: payment.currency,
        status: "SUBMITTED",
        proofFileId: input.proofFileId,
      },
    });
    // Conditional update guards against a concurrent double submit.
    const updated = await tx.registrationPayment.updateMany({
      where: { id: payment.id, status: { in: ["AWAITING_PAYMENT", "REJECTED"] } },
      data: { status: "UNDER_REVIEW", reviewNote: null },
    });
    if (updated.count !== 1) throw conflict("Your payment is already being processed.");
    await audit({ actorId: userId, action: "payment.submit", entityType: "RegistrationPayment", entityId: payment.id, metadata: { method: input.method } }, tx);
  });
}

/** Staff confirm or reject the most recent submitted transaction for a registration payment. */
export async function reviewRegistrationPayment(actor: SessionUser, paymentId: string, decision: "verify" | "reject", note?: string) {
  if (decision === "reject" && !note) throw new AppError("Give a reason so the user can correct the payment.");
  const payment = await db.registrationPayment.findUnique({
    where: { id: paymentId },
    include: { transactions: { where: { status: "SUBMITTED" }, orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!payment) throw notFound();
  if (payment.userId === actor.id) throw forbidden("You cannot review your own payment.");
  if (payment.status !== "UNDER_REVIEW") throw conflict("This payment is not awaiting review.");
  const txn = payment.transactions[0];
  if (!txn) throw conflict("There is no submitted transaction to review.");

  const now = new Date();
  await db.$transaction(async (tx) => {
    const moved = await tx.paymentTransaction.updateMany({
      where: { id: txn.id, status: "SUBMITTED" },
      data:
        decision === "verify"
          ? { status: "SUCCEEDED", verifiedAt: now, verifiedById: actor.id }
          : { status: "REJECTED", failureReason: note, verifiedById: actor.id },
    });
    if (moved.count !== 1) throw conflict("This transaction was already processed.");
    await tx.registrationPayment.update({
      where: { id: payment.id },
      data: {
        status: decision === "verify" ? "VERIFIED" : "REJECTED",
        reviewedById: actor.id,
        reviewedAt: now,
        reviewNote: note ?? null,
        receiptNumber: decision === "verify" ? `LOSO-R-${now.getFullYear()}-${payment.id.toUpperCase()}` : undefined,
      },
    });
    await audit(
      { actorId: actor.id, action: `payment.${decision}`, entityType: "RegistrationPayment", entityId: payment.id, metadata: { transactionId: txn.id, note: note ?? null } },
      tx,
    );
    await notify(
      {
        userId: payment.userId,
        type: "PAYMENT",
        title: decision === "verify" ? "Registration payment confirmed" : "Registration payment could not be confirmed",
        body: decision === "verify" ? "Your payment was verified. Your documents are next in the review queue." : note,
        link: "/account-status",
      },
      tx,
    );
  });
}

// ─── Verification ────────────────────────────────────────────────────────────

export async function submitVerification(
  userId: string,
  input: { documents: { fileId: string; kind: DocumentKind }[]; note?: string },
): Promise<void> {
  if (input.documents.length === 0) throw new AppError("Upload at least one identity document.");
  const latest = await db.verificationSubmission.findFirst({ where: { userId, companyId: null }, orderBy: { createdAt: "desc" } });
  if (latest && ["SUBMITTED", "APPROVED"].includes(latest.status)) {
    throw conflict(latest.status === "APPROVED" ? "You are already verified." : "Your documents are already waiting for review.");
  }
  await db.$transaction(async (tx) => {
    const sub = await tx.verificationSubmission.create({
      data: { userId, applicantNote: input.note, documents: { create: input.documents } },
    });
    await audit({ actorId: userId, action: "verification.submit", entityType: "VerificationSubmission", entityId: sub.id }, tx);
  });
}

export async function reviewVerification(
  actor: SessionUser,
  submissionId: string,
  decision: "approve" | "reject" | "request_changes",
  note?: string,
) {
  if (decision !== "approve" && !note) throw new AppError("A reason is required so the applicant knows what to do next.");
  const sub = await db.verificationSubmission.findUnique({ where: { id: submissionId }, include: { company: true } });
  if (!sub) throw notFound();
  if (sub.userId === actor.id) throw forbidden("You cannot review your own submission.");
  if (sub.status !== "SUBMITTED") throw conflict("This submission has already been reviewed.");
  const status = decision === "approve" ? "APPROVED" : decision === "reject" ? "REJECTED" : "CHANGES_REQUESTED";

  await db.$transaction(async (tx) => {
    await tx.verificationSubmission.update({
      where: { id: sub.id },
      data: { status, reviewerNote: note ?? null, reviewedById: actor.id, reviewedAt: new Date() },
    });
    if (sub.companyId) {
      if (decision !== "request_changes") {
        await tx.company.update({
          where: { id: sub.companyId },
          data:
            decision === "approve"
              ? { status: "APPROVED", verifiedAt: new Date(), verifiedById: actor.id, statusReason: null }
              : { status: "REJECTED", statusReason: note },
        });
      }
    } else if (decision === "reject") {
      // Rejected identity verification rejects the registration (recorded with reason).
      await tx.user.update({ where: { id: sub.userId }, data: { status: "REJECTED", statusReason: note } });
    }
    await audit({ actorId: actor.id, action: `verification.${decision}`, entityType: "VerificationSubmission", entityId: sub.id, metadata: { note: note ?? null } }, tx);
    await notify(
      {
        userId: sub.userId,
        type: "ACCOUNT",
        title:
          decision === "approve"
            ? sub.companyId ? "Company verified" : "Documents approved"
            : decision === "reject"
              ? sub.companyId ? "Company verification rejected" : "Registration rejected"
              : "Please update your submission",
        body: note,
        link: sub.companyId ? "/employer/company" : "/account-status",
      },
      tx,
    );
  });
}

// ─── Activation & account control ───────────────────────────────────────────

/** Activation requires BOTH a verified (or waived) payment AND approved verification. */
export async function activateUser(actor: SessionUser, userId: string, note?: string) {
  if (userId === actor.id) throw forbidden("You cannot change your own account status.");
  const { snapshot } = await getAccountSnapshot(userId);
  const check = canActivate(snapshot);
  if (!check.ok) throw conflict(check.reason);
  await db.$transaction(async (tx) => {
    const updated = await tx.user.updateMany({
      where: { id: userId, status: "PENDING" },
      data: { status: "ACTIVE", activatedAt: new Date(), activatedById: actor.id, statusReason: null },
    });
    if (updated.count !== 1) throw conflict("Only pending accounts can be activated.");
    await audit({ actorId: actor.id, action: "user.activate", entityType: "User", entityId: userId, metadata: { note: note ?? null } }, tx);
    await notify({ userId, type: "ACCOUNT", title: "Your Loso account is active", body: "Welcome! You can now use all features.", link: "/dashboard" }, tx);
  });
}

export async function setAccountStatus(actor: SessionUser, userId: string, action: "suspend" | "reactivate" | "reject", reason?: string) {
  if (userId === actor.id) throw forbidden("You cannot change your own account status.");
  if (action !== "reactivate" && !reason) throw new AppError("A reason is required.");
  const target = await db.user.findUnique({ where: { id: userId }, include: { roles: true } });
  if (!target) throw notFound();
  const targetRoles = target.roles.map((r) => r.role);
  // Staff accounts can only be managed by a super admin; super admins cannot be suspended via UI.
  if (targetRoles.includes("SUPER_ADMIN")) throw forbidden("Super admin accounts cannot be changed here.");
  if (targetRoles.some((r) => r === "ADMIN" || r === "MODERATOR") && !actor.roles.includes("SUPER_ADMIN")) throw forbidden();

  const allowed: Record<typeof action, string[]> = { suspend: ["ACTIVE", "PENDING"], reactivate: ["SUSPENDED"], reject: ["PENDING"] };
  if (!allowed[action].includes(target.status)) throw conflict(`Cannot ${action} an account that is ${target.status.toLowerCase()}.`);
  const status = action === "suspend" ? "SUSPENDED" : action === "reject" ? "REJECTED" : target.activatedAt ? "ACTIVE" : "PENDING";

  await db.$transaction(async (tx) => {
    await tx.user.update({ where: { id: userId }, data: { status, statusReason: reason ?? null } });
    await audit({ actorId: actor.id, action: `user.${action}`, entityType: "User", entityId: userId, metadata: { reason: reason ?? null } }, tx);
    await notify(
      {
        userId,
        type: "ACCOUNT",
        title: action === "suspend" ? "Your account has been suspended" : action === "reject" ? "Your registration was not approved" : "Your account has been reactivated",
        body: reason,
        link: "/account-status",
      },
      tx,
    );
  });
  if (action !== "reactivate") await destroyAllSessions(userId);
}

export async function setStaffRole(actor: SessionUser, userId: string, role: Role, grant: boolean) {
  if (!canAssignRole(actor.roles, actor.id, userId, role)) throw forbidden();
  if (!["ADMIN", "MODERATOR"].includes(role)) throw forbidden("Only staff roles can be changed here.");
  await db.$transaction(async (tx) => {
    if (grant) await tx.userRole.upsert({ where: { userId_role: { userId, role } }, create: { userId, role, grantedById: actor.id }, update: {} });
    else await tx.userRole.deleteMany({ where: { userId, role } });
    await audit({ actorId: actor.id, action: grant ? "role.grant" : "role.revoke", entityType: "User", entityId: userId, metadata: { role } }, tx);
  });
}
