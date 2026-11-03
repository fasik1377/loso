import { describe, expect, it } from "vitest";
import { canActivate, deriveAccountStage } from "@/lib/domain/account";
import { availableActions, nextServiceRequestStatus } from "@/lib/domain/service-request";
import { averageRating, reviewEligibility } from "@/lib/domain/review";
import { applicantCanWithdraw, employerCanMove, employerCanSetJobStatus, jobAcceptsApplications } from "@/lib/domain/application";
import { canAssignRole, hasPermission } from "@/lib/domain/permissions";
import { adDisplayStatus, sanitizeDestinationUrl } from "@/lib/domain/ads";
import { safeFileName, sniffMime } from "@/lib/domain/files";

describe("account stage (payment and verification are independent)", () => {
  const worker = { status: "PENDING" as const, roles: ["WORKER" as const] };

  it("a new worker is pending payment", () => {
    expect(deriveAccountStage({ ...worker, payment: { status: "AWAITING_PAYMENT" }, verification: null })).toBe("PENDING_PAYMENT");
  });
  it("submitted payment is under review", () => {
    expect(deriveAccountStage({ ...worker, payment: { status: "UNDER_REVIEW" }, verification: null })).toBe("PAYMENT_UNDER_REVIEW");
  });
  it("a verified payment does NOT imply verification — documents still required", () => {
    expect(deriveAccountStage({ ...worker, payment: { status: "VERIFIED" }, verification: null })).toBe("PENDING_DOCUMENTS");
    expect(canActivate({ ...worker, payment: { status: "VERIFIED" }, verification: null }).ok).toBe(false);
  });
  it("approved documents without payment cannot be activated", () => {
    const s = { ...worker, payment: { status: "AWAITING_PAYMENT" as const }, verification: { status: "APPROVED" as const } };
    expect(deriveAccountStage(s)).toBe("PENDING_PAYMENT");
    expect(canActivate(s).ok).toBe(false);
  });
  it("both gates passed → awaiting activation and activatable", () => {
    const s = { ...worker, payment: { status: "VERIFIED" as const }, verification: { status: "APPROVED" as const } };
    expect(deriveAccountStage(s)).toBe("AWAITING_ACTIVATION");
    expect(canActivate(s).ok).toBe(true);
  });
  it("waived fee counts as satisfied", () => {
    expect(canActivate({ ...worker, payment: { status: "WAIVED" }, verification: { status: "APPROVED" } }).ok).toBe(true);
  });
  it("suspended/rejected/active accounts report their status regardless of other records", () => {
    expect(deriveAccountStage({ status: "SUSPENDED", roles: ["WORKER"], payment: { status: "VERIFIED" }, verification: { status: "APPROVED" } })).toBe("SUSPENDED");
    expect(deriveAccountStage({ status: "REJECTED", roles: ["WORKER"], payment: null, verification: null })).toBe("REJECTED");
    expect(canActivate({ status: "ACTIVE", roles: ["WORKER"], payment: { status: "VERIFIED" }, verification: { status: "APPROVED" } }).ok).toBe(false);
  });
  it("changes requested is surfaced", () => {
    expect(deriveAccountStage({ ...worker, payment: { status: "VERIFIED" }, verification: { status: "CHANGES_REQUESTED" } })).toBe("CHANGES_REQUESTED");
  });
});

describe("service request state machine", () => {
  it("follows Requested → Accepted → In progress → Completed", () => {
    expect(nextServiceRequestStatus("REQUESTED", "accept", "worker")).toEqual({ ok: true, to: "ACCEPTED" });
    expect(nextServiceRequestStatus("ACCEPTED", "start", "worker")).toEqual({ ok: true, to: "IN_PROGRESS" });
    expect(nextServiceRequestStatus("IN_PROGRESS", "confirmComplete", "customer")).toEqual({ ok: true, to: "COMPLETED" });
  });
  it("only the customer can confirm completion", () => {
    expect(nextServiceRequestStatus("IN_PROGRESS", "confirmComplete", "worker").ok).toBe(false);
  });
  it("customers cannot accept their own request", () => {
    expect(nextServiceRequestStatus("REQUESTED", "accept", "customer").ok).toBe(false);
  });
  it("cannot skip straight to completed", () => {
    expect(nextServiceRequestStatus("REQUESTED", "confirmComplete", "customer").ok).toBe(false);
    expect(nextServiceRequestStatus("ACCEPTED", "confirmComplete", "customer").ok).toBe(false);
  });
  it("cancellation only before work starts; workers decline instead of cancel", () => {
    expect(nextServiceRequestStatus("REQUESTED", "cancel", "customer").ok).toBe(true);
    expect(nextServiceRequestStatus("ACCEPTED", "cancel", "worker").ok).toBe(true);
    expect(nextServiceRequestStatus("REQUESTED", "cancel", "worker").ok).toBe(false);
    expect(nextServiceRequestStatus("IN_PROGRESS", "cancel", "customer").ok).toBe(false);
  });
  it("terminal states allow nothing", () => {
    for (const s of ["COMPLETED", "DECLINED", "CANCELLED"] as const) {
      expect(availableActions(s, "customer")).toEqual([]);
      expect(availableActions(s, "worker")).toEqual([]);
    }
  });
});

describe("reviews", () => {
  const base = { customerId: "c", workerId: "w", status: "COMPLETED" as const, hasReview: false };
  it("only the customer of a completed request may review, once", () => {
    expect(reviewEligibility(base, "c").ok).toBe(true);
    expect(reviewEligibility(base, "w").ok).toBe(false);
    expect(reviewEligibility(base, "someone-else").ok).toBe(false);
    expect(reviewEligibility({ ...base, status: "IN_PROGRESS" }, "c").ok).toBe(false);
    expect(reviewEligibility({ ...base, hasReview: true }, "c").ok).toBe(false);
  });
  it("cannot review yourself even if listed as both parties", () => {
    expect(reviewEligibility({ ...base, customerId: "x", workerId: "x" }, "x").ok).toBe(false);
  });
  it("average is computed from given ratings only", () => {
    expect(averageRating([])).toBeNull();
    expect(averageRating([5, 4, 4])).toBe(4.33);
  });
});

describe("jobs & applications", () => {
  const job = { status: "PUBLISHED" as const, deadline: new Date(Date.now() + 86400000), applicationMethod: "IN_APP" };
  it("accepts applications only while published and before the deadline", () => {
    expect(jobAcceptsApplications(job).ok).toBe(true);
    expect(jobAcceptsApplications({ ...job, status: "PAUSED" }).ok).toBe(false);
    expect(jobAcceptsApplications({ ...job, deadline: new Date(Date.now() - 1000) }).ok).toBe(false);
    expect(jobAcceptsApplications({ ...job, applicationMethod: "EMAIL" }).ok).toBe(false);
  });
  it("employer pipeline transitions", () => {
    expect(employerCanMove("SUBMITTED", "SHORTLISTED")).toBe(true);
    expect(employerCanMove("SHORTLISTED", "INTERVIEW")).toBe(true);
    expect(employerCanMove("HIRED", "REJECTED")).toBe(false);
    expect(employerCanMove("WITHDRAWN", "UNDER_REVIEW")).toBe(false);
    expect(employerCanMove("SUBMITTED", "HIRED")).toBe(false);
  });
  it("withdrawal is blocked once final", () => {
    expect(applicantCanWithdraw("INTERVIEW")).toBe(true);
    expect(applicantCanWithdraw("HIRED")).toBe(false);
  });
  it("job status transitions", () => {
    expect(employerCanSetJobStatus("PUBLISHED", "PAUSED")).toBe(true);
    expect(employerCanSetJobStatus("CLOSED", "PUBLISHED")).toBe(true); // renew
    expect(employerCanSetJobStatus("REMOVED", "PUBLISHED")).toBe(false);
    expect(employerCanSetJobStatus("REJECTED", "PUBLISHED")).toBe(false);
  });
});

describe("permissions", () => {
  it("members have no admin permissions", () => {
    for (const r of ["WORKER", "CUSTOMER", "EMPLOYER"] as const) expect(hasPermission([r], "admin.access")).toBe(false);
  });
  it("moderators are least-privilege", () => {
    expect(hasPermission(["MODERATOR"], "content.moderate")).toBe(true);
    expect(hasPermission(["MODERATOR"], "payments.review")).toBe(false);
    expect(hasPermission(["MODERATOR"], "settings.manage")).toBe(false);
  });
  it("only super admins manage settings and roles", () => {
    expect(hasPermission(["ADMIN"], "settings.manage")).toBe(false);
    expect(hasPermission(["SUPER_ADMIN"], "settings.manage")).toBe(true);
  });
  it("nobody can grant themselves a role or grant SUPER_ADMIN via the UI", () => {
    expect(canAssignRole(["SUPER_ADMIN"], "a", "a", "ADMIN")).toBe(false);
    expect(canAssignRole(["SUPER_ADMIN"], "a", "b", "SUPER_ADMIN")).toBe(false);
    expect(canAssignRole(["ADMIN"], "a", "b", "MODERATOR")).toBe(false);
    expect(canAssignRole(["SUPER_ADMIN"], "a", "b", "MODERATOR")).toBe(true);
  });
});

describe("advertisements", () => {
  const now = new Date("2026-06-15T12:00:00Z");
  const ad = { status: "APPROVED" as const, startsAt: new Date("2026-06-01"), endsAt: new Date("2026-06-30") };
  it("derives scheduled/active/expired from dates", () => {
    expect(adDisplayStatus(ad, now)).toBe("ACTIVE");
    expect(adDisplayStatus({ ...ad, startsAt: new Date("2026-07-01"), endsAt: new Date("2026-07-30") }, now)).toBe("SCHEDULED");
    expect(adDisplayStatus({ ...ad, endsAt: new Date("2026-06-10") }, now)).toBe("EXPIRED");
    expect(adDisplayStatus({ ...ad, status: "PENDING" }, now)).toBe("PENDING");
  });
  it("only allows plain http(s) destinations", () => {
    expect(sanitizeDestinationUrl("https://example.com/x")).toBe("https://example.com/x");
    expect(sanitizeDestinationUrl("javascript:alert(1)")).toBeNull();
    expect(sanitizeDestinationUrl("data:text/html,<script>")).toBeNull();
    expect(sanitizeDestinationUrl("https://user:pw@evil.com")).toBeNull();
    expect(sanitizeDestinationUrl("not a url")).toBeNull();
  });
});

describe("file validation", () => {
  it("detects real types from magic bytes, not names", () => {
    expect(sniffMime(new Uint8Array([0xff, 0xd8, 0xff, 0xe0]))).toBe("image/jpeg");
    expect(sniffMime(new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe("image/png");
    expect(sniffMime(new TextEncoder().encode("%PDF-1.7"))).toBe("application/pdf");
    expect(sniffMime(new TextEncoder().encode("<svg onload=alert(1)>"))).toBeNull();
    expect(sniffMime(new TextEncoder().encode("<html><script>"))).toBeNull();
  });
  it("strips paths from file names", () => {
    expect(safeFileName("../../etc/passwd")).toBe("passwd");
    expect(safeFileName("C:\\x\\cv<script>.pdf")).toBe("cv_script_.pdf");
  });
});
