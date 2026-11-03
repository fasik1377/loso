import type {
  AccountStatus,
  RegistrationPaymentStatus,
  Role,
  VerificationStatus,
} from "@/lib/generated/prisma";

/**
 * The user-facing account stage is DERIVED from three independent records:
 * account status, registration payment status and verification status.
 * Paying never implies verification, and neither implies activation.
 */
export type AccountStage =
  | "PENDING_PAYMENT"
  | "PAYMENT_UNDER_REVIEW"
  | "PAYMENT_REJECTED"
  | "PENDING_DOCUMENTS"
  | "PENDING_VERIFICATION"
  | "CHANGES_REQUESTED"
  | "AWAITING_ACTIVATION"
  | "ACTIVE"
  | "REJECTED"
  | "SUSPENDED"
  | "DEACTIVATED";

export interface AccountSnapshot {
  status: AccountStatus;
  roles: readonly Role[];
  payment: { status: RegistrationPaymentStatus } | null;
  verification: { status: VerificationStatus } | null;
}

/** Workers pay a registration fee and are verified; customers/employers follow lighter policies. */
export function requiresRegistrationFee(roles: readonly Role[]): boolean {
  return roles.includes("WORKER");
}

/** Job seekers/workers (identity documents) and employers (business documents) must be verified by an admin. */
export function requiresVerification(roles: readonly Role[]): boolean {
  return roles.includes("WORKER") || roles.includes("EMPLOYER");
}

export function deriveAccountStage(s: AccountSnapshot): AccountStage {
  if (s.status === "ACTIVE") return "ACTIVE";
  if (s.status === "SUSPENDED") return "SUSPENDED";
  if (s.status === "REJECTED") return "REJECTED";
  if (s.status === "DEACTIVATED") return "DEACTIVATED";

  if (requiresRegistrationFee(s.roles)) {
    const p = s.payment?.status ?? "AWAITING_PAYMENT";
    if (p === "AWAITING_PAYMENT") return "PENDING_PAYMENT";
    if (p === "UNDER_REVIEW") return "PAYMENT_UNDER_REVIEW";
    if (p === "REJECTED") return "PAYMENT_REJECTED";
  }
  if (requiresVerification(s.roles)) {
    const v = s.verification?.status;
    if (!v) return "PENDING_DOCUMENTS";
    if (v === "SUBMITTED") return "PENDING_VERIFICATION";
    if (v === "CHANGES_REQUESTED") return "CHANGES_REQUESTED";
    if (v === "REJECTED") return "REJECTED";
  }
  return "AWAITING_ACTIVATION";
}

/** Activation is only allowed when every required gate has independently passed. */
export function canActivate(s: AccountSnapshot): { ok: true } | { ok: false; reason: string } {
  if (s.status === "ACTIVE") return { ok: false, reason: "Account is already active." };
  if (requiresRegistrationFee(s.roles) && !["VERIFIED", "WAIVED"].includes(s.payment?.status ?? "")) {
    return { ok: false, reason: "Registration payment has not been verified." };
  }
  if (requiresVerification(s.roles) && s.verification?.status !== "APPROVED") {
    return { ok: false, reason: "Identity/document verification has not been approved." };
  }
  return { ok: true };
}

export const STAGE_INFO: Record<AccountStage, { label: string; tone: "neutral" | "warning" | "success" | "danger"; help: string }> = {
  PENDING_PAYMENT: {
    label: "Pending Payment",
    tone: "warning",
    help: "Pay the registration fee and submit your payment reference so our team can confirm it.",
  },
  PAYMENT_UNDER_REVIEW: {
    label: "Payment Under Review",
    tone: "neutral",
    help: "We received your payment details. A staff member will confirm the payment.",
  },
  PAYMENT_REJECTED: {
    label: "Payment Rejected",
    tone: "danger",
    help: "We could not confirm your payment. Read the reason below and submit corrected details.",
  },
  PENDING_DOCUMENTS: {
    label: "Documents Required",
    tone: "warning",
    help: "Upload your documents so an administrator can verify your account. You can't use Loso until it is approved.",
  },
  PENDING_VERIFICATION: {
    label: "Pending Verification",
    tone: "neutral",
    help: "Your documents are waiting for review by our verification team.",
  },
  CHANGES_REQUESTED: {
    label: "Changes Requested",
    tone: "warning",
    help: "A reviewer asked for corrected information. See the note below and resubmit.",
  },
  AWAITING_ACTIVATION: {
    label: "Awaiting Activation",
    tone: "neutral",
    help: "All checks have passed. An administrator will activate your account shortly.",
  },
  ACTIVE: { label: "Active", tone: "success", help: "Your account is active." },
  REJECTED: {
    label: "Rejected",
    tone: "danger",
    help: "Your registration was not approved. Contact support if you believe this is a mistake.",
  },
  SUSPENDED: {
    label: "Suspended",
    tone: "danger",
    help: "Your account has been suspended. Contact support for more information.",
  },
  DEACTIVATED: { label: "Deactivated", tone: "neutral", help: "This account has been deactivated." },
};
