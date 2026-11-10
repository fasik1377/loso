/**
 * End-to-end business workflows against a real PostgreSQL database (DATABASE_URL).
 * Each test creates its own uniquely-numbered users, so it can run against a dev database.
 * Skipped automatically when DATABASE_URL is not set.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { SessionUser } from "@/lib/auth/session";

const enabled = !!process.env.DATABASE_URL;
const run = Math.floor(Math.random() * 900000 + 100000); // unique phone block per run
let seq = 0;
const phone = () => `+25195${String(run % 1000).padStart(3, "0")}${String(seq++).padStart(4, "0")}`;

describe.skipIf(!enabled)("workflows (database)", async () => {
  const { db } = await import("@/lib/db");
  const auth = await import("@/lib/services/auth");
  const accounts = await import("@/lib/services/accounts");
  const jobs = await import("@/lib/services/jobs");
  const sr = await import("@/lib/services/service-requests");
  const messaging = await import("@/lib/services/messaging");
  const files = await import("@/lib/services/files");
  const { jobSchema } = await import("@/lib/validation/schemas");

  const created: string[] = [];

  async function sessionUser(id: string): Promise<SessionUser> {
    const u = await db.user.findUniqueOrThrow({ where: { id }, include: { roles: true } });
    return { id: u.id, fullName: u.fullName, phone: u.phone, email: u.email, status: u.status, roles: u.roles.map((r) => r.role) };
  }

  async function register(accountType: "WORKER" | "CUSTOMER" | "EMPLOYER", extra: Record<string, unknown> = {}) {
    const { userId } = await auth.registerUser({
      accountType,
      fullName: `Test ${accountType} ${run}`,
      phone: phone(),
      email: undefined,
      password: "Password123",
      confirmPassword: "Password123",
      seeksJobs: true,
      offersServices: true,
      employerType: "COMPANY",
      companyName: accountType === "EMPLOYER" ? `Test Co ${run}` : undefined,
      acceptTerms: true,
      ...extra,
    } as never);
    created.push(userId);
    return userId;
  }

  /** A registered customer that an administrator has approved. */
  async function activeCustomer() {
    const id = await register("CUSTOMER");
    await db.user.update({ where: { id }, data: { status: "ACTIVE", activatedAt: new Date() } });
    return sessionUser(id);
  }

  async function staff(role: "ADMIN" | "MODERATOR" = "ADMIN") {
    const u = await db.user.create({
      data: { fullName: `Test ${role}`, phone: phone(), passwordHash: "x", status: "ACTIVE", roles: { create: [{ role }] } },
    });
    created.push(u.id);
    return sessionUser(u.id);
  }

  async function activeWorker() {
    const id = await register("WORKER");
    await db.registrationPayment.update({ where: { userId: id }, data: { status: "WAIVED" } });
    await db.verificationSubmission.create({ data: { userId: id, status: "APPROVED" } });
    await db.user.update({ where: { id }, data: { status: "ACTIVE" } });
    const cat = await db.serviceCategory.findFirst({ where: { active: true } });
    const category = cat ?? (await db.serviceCategory.create({ data: { name: `Cat ${run}`, slug: `cat-${run}` } }));
    const wp = await db.workerProfile.findUniqueOrThrow({ where: { userId: id } });
    await db.workerService.create({ data: { workerId: wp.id, categoryId: category.id, title: "Test service" } });
    return { user: await sessionUser(id), categoryId: category.id };
  }

  beforeAll(async () => {
    // Ensure a non-zero fee so the payment gate is exercised.
    await db.platformSetting.upsert({ where: { key: "registrationFeeMinor" }, create: { key: "registrationFeeMinor", value: 20000 }, update: { value: 20000 } });
  });

  afterAll(async () => {
    await db.auditLog.deleteMany({ where: { OR: [{ actorId: { in: created } }, { entityId: { in: created } }] } });
    await db.job.deleteMany({ where: { postedById: { in: created } } });
    // One at a time: on MongoDB Prisma emulates cascades, and a bulk delete can outlast the
    // transaction window on a high-latency connection.
    for (const id of created) await db.user.delete({ where: { id } }).catch(() => undefined);
    await db.$disconnect();
  }, 600_000); // cleanup of emulated cascades is slow over high-latency links

  it("worker registration: pending → payment verified → documents approved → activated", async () => {
    const admin = await staff();
    const id = await register("WORKER");
    let snap = await accounts.getAccountSnapshot(id);
    expect(snap.user.status).toBe("PENDING");
    expect(snap.stage).toBe("PENDING_PAYMENT");
    expect(snap.payment?.amountMinor).toBe(20000);

    // Cannot activate before payment & verification.
    await expect(accounts.activateUser(admin, id)).rejects.toThrow(/payment/i);

    const ref = `TEST-${run}-A`;
    await accounts.submitManualPayment(id, { method: "bank_transfer", reference: ref, proofFileId: null });
    // The same reference can never be submitted twice (by anyone).
    const other = await register("WORKER");
    await expect(accounts.submitManualPayment(other, { method: "bank_transfer", reference: ref.toLowerCase(), proofFileId: null })).rejects.toThrow(/already been submitted/);
    // Double submit while under review is rejected.
    await expect(accounts.submitManualPayment(id, { method: "bank_transfer", reference: `${ref}-2`, proofFileId: null })).rejects.toThrow(/under review/);

    snap = await accounts.getAccountSnapshot(id);
    expect(snap.stage).toBe("PAYMENT_UNDER_REVIEW");
    await accounts.reviewRegistrationPayment(admin, snap.payment!.id, "verify");
    // Re-processing the same payment is refused (idempotency).
    await expect(accounts.reviewRegistrationPayment(admin, snap.payment!.id, "verify")).rejects.toThrow();

    snap = await accounts.getAccountSnapshot(id);
    expect(snap.payment?.status).toBe("VERIFIED");
    expect(snap.payment?.receiptNumber).toMatch(/^LOOSO-R-/);
    expect(snap.user.status).toBe("PENDING"); // payment alone does not activate
    expect(snap.stage).toBe("PENDING_DOCUMENTS");
    await expect(accounts.activateUser(admin, id)).rejects.toThrow(/verification/i);

    const doc = await db.storedFile.create({ data: { ownerId: id, storageKey: `test/${run}/id.pdf`, originalName: "id.pdf", mimeType: "application/pdf", sizeBytes: 10, purpose: "ID_DOCUMENT" } });
    await accounts.submitVerification(id, { documents: [{ fileId: doc.id, kind: "NATIONAL_ID" }] });
    const sub = await db.verificationSubmission.findFirstOrThrow({ where: { userId: id } });
    await accounts.reviewVerification(admin, sub.id, "approve");
    await accounts.activateUser(admin, id);

    const user = await db.user.findUniqueOrThrow({ where: { id } });
    expect(user.status).toBe("ACTIVE");
    expect(user.activatedById).toBe(admin.id);
    expect(await db.auditLog.count({ where: { entityId: id, action: "user.activate", actorId: admin.id } })).toBe(1);
    expect(await db.notification.count({ where: { userId: id, type: "ACCOUNT" } })).toBeGreaterThan(0);
  });

  it("rejections require a reason and staff cannot review their own records", async () => {
    const admin = await staff();
    const id = await register("WORKER");
    await accounts.submitManualPayment(id, { method: "bank_transfer", reference: `TEST-${run}-R`, proofFileId: null });
    const p = await db.registrationPayment.findUniqueOrThrow({ where: { userId: id } });
    await expect(accounts.reviewRegistrationPayment(admin, p.id, "reject")).rejects.toThrow(/reason/i);
    await accounts.reviewRegistrationPayment(admin, p.id, "reject", "Reference not found on statement");
    expect((await accounts.getAccountSnapshot(id)).stage).toBe("PAYMENT_REJECTED");
    // The user can resubmit corrected details.
    await accounts.submitManualPayment(id, { method: "bank_transfer", reference: `TEST-${run}-R2`, proofFileId: null });
    expect((await accounts.getAccountSnapshot(id)).stage).toBe("PAYMENT_UNDER_REVIEW");

    await expect(accounts.setAccountStatus(admin, admin.id, "suspend", "x")).rejects.toThrow(/own account/);
  });

  it("customers pay no fee but still need admin approval before using Looso", async () => {
    const admin = await staff();
    const id = await register("CUSTOMER");
    let snap = await accounts.getAccountSnapshot(id);
    expect(snap.user.status).toBe("PENDING");
    expect(snap.stage).toBe("AWAITING_ACTIVATION");
    expect(snap.payment).toBeNull();
    await accounts.activateUser(admin, id);
    snap = await accounts.getAccountSnapshot(id);
    expect(snap.user.status).toBe("ACTIVE");
  });

  it("service request lifecycle and one review per completed request", async () => {
    const { user: worker, categoryId } = await activeWorker();
    const customer = await activeCustomer();
    const stranger = await activeCustomer();

    const req = await sr.createServiceRequest(customer, { workerId: worker.id, categoryId, title: "Fix sink", description: "Kitchen sink is leaking badly", preferredAt: undefined, locationId: undefined, addressDetail: undefined, budget: undefined }, []);
    expect(req.status).toBe("REQUESTED");

    // Not a participant → not found; customer cannot accept; cannot review before completion.
    await expect(sr.getServiceRequestFor(stranger, req.id)).rejects.toThrow();
    await expect(sr.transitionServiceRequest(customer, req.id, "accept")).rejects.toThrow();
    await expect(sr.createReview(customer, { serviceRequestId: req.id, rating: 5, comment: undefined })).rejects.toThrow(/completed/);

    await sr.transitionServiceRequest(worker, req.id, "accept");
    await sr.transitionServiceRequest(worker, req.id, "start");
    await sr.transitionServiceRequest(worker, req.id, "markFinished");
    await expect(sr.transitionServiceRequest(worker, req.id, "confirmComplete")).rejects.toThrow();
    await sr.transitionServiceRequest(customer, req.id, "confirmComplete");

    await expect(sr.createReview(worker, { serviceRequestId: req.id, rating: 5, comment: undefined })).rejects.toThrow();
    await expect(sr.createReview(stranger, { serviceRequestId: req.id, rating: 1, comment: undefined })).rejects.toThrow();
    await sr.createReview(customer, { serviceRequestId: req.id, rating: 4, comment: "Good work" });
    await expect(sr.createReview(customer, { serviceRequestId: req.id, rating: 5, comment: undefined })).rejects.toThrow(/already/);

    const wp = await db.workerProfile.findUniqueOrThrow({ where: { userId: worker.id } });
    expect(Number(wp.ratingAverage)).toBe(4);
    expect(wp.ratingCount).toBe(1);
    expect(wp.completedCount).toBe(1);

    // Hiding a review recomputes the aggregate.
    const admin = await staff("MODERATOR");
    const review = await db.review.findUniqueOrThrow({ where: { serviceRequestId: req.id } });
    await sr.moderateReview(admin, review.id, true, "Policy violation");
    const after = await db.workerProfile.findUniqueOrThrow({ where: { userId: worker.id } });
    expect(after.ratingCount).toBe(0);
    expect(after.ratingAverage).toBeNull();
  });

  it("employer must be verified to publish; applications are unique", async () => {
    const employer = await sessionUser(await register("EMPLOYER"));
    // Employers start pending: an administrator must verify them before they can use Looso.
    expect(employer.status).toBe("PENDING");
    expect((await accounts.getAccountSnapshot(employer.id)).stage).toBe("PENDING_DOCUMENTS");
    const { user: worker } = await activeWorker();
    const input = jobSchema.parse({
      title: "Test cashier",
      description: "Handle cash register and customer service at our shop.",
      employmentType: "FULL_TIME",
      experienceLevel: "ENTRY",
      workplaceType: "ON_SITE",
      salaryVisible: true,
      vacancies: 1,
      applicationMethod: "IN_APP",
      questions: [{ text: "Years of experience?" }],
    });
    await expect(jobs.createJob(employer, input, true)).rejects.toThrow(/verified/);
    const draft = await jobs.createJob(employer, input, false);
    expect(draft.status).toBe("DRAFT");
    // Applying to a draft is refused.
    await expect(jobs.applyToJob(worker, { jobId: draft.id, resumeId: undefined, coverLetter: undefined, answers: {} })).rejects.toThrow();

    await db.company.updateMany({ where: { ownerId: employer.id }, data: { status: "APPROVED" } });
    await jobs.setJobStatus(employer, draft.id, "PUBLISHED");
    const q = await db.jobQuestion.findFirstOrThrow({ where: { jobId: draft.id } });
    const app = await jobs.applyToJob(worker, { jobId: draft.id, resumeId: undefined, coverLetter: undefined, answers: { [q.id]: "3" } });
    await expect(jobs.applyToJob(worker, { jobId: draft.id, resumeId: undefined, coverLetter: undefined, answers: { [q.id]: "3" } })).rejects.toThrow(/already applied/);

    // Another employer cannot manage this application.
    const otherEmployer = await sessionUser(await register("EMPLOYER"));
    await expect(jobs.updateApplicationStatus(otherEmployer, app.id, "SHORTLISTED", {})).rejects.toThrow();
    await jobs.updateApplicationStatus(employer, app.id, "SHORTLISTED", {});
    expect((await db.jobApplication.findUniqueOrThrow({ where: { id: app.id } })).status).toBe("SHORTLISTED");
    expect(await db.notification.count({ where: { userId: worker.id, type: "APPLICATION" } })).toBeGreaterThan(0);
  });

  it("messages are persisted and private to participants", async () => {
    const { user: worker } = await activeWorker();
    const customer = await activeCustomer();
    const stranger = await activeCustomer();
    const convo = await messaging.startDirectConversation(customer, worker.id);
    await messaging.sendMessage(customer, convo, "Hello, are you available tomorrow?");
    expect(await messaging.unreadMessageCount(worker.id)).toBe(1);
    const msgs = await messaging.getMessages(worker.id, convo);
    expect(msgs.map((m) => m.body)).toEqual(["Hello, are you available tomorrow?"]);
    expect(await messaging.unreadMessageCount(worker.id)).toBe(0);
    await expect(messaging.getMessages(stranger.id, convo)).rejects.toThrow();
    await expect(messaging.sendMessage(stranger, convo, "hi")).rejects.toThrow();
  });

  it("private files are not readable by other users", async () => {
    const owner = await register("WORKER");
    const stranger = await activeCustomer();
    const moderator = await staff("MODERATOR");
    const f = await db.storedFile.create({ data: { ownerId: owner, storageKey: `test/${run}/pp.pdf`, originalName: "p.pdf", mimeType: "application/pdf", sizeBytes: 1, purpose: "PAYMENT_PROOF" } });
    expect(await files.canReadFile(stranger, f.id)).toBeNull();
    expect(await files.canReadFile(null, f.id)).toBeNull();
    expect(await files.canReadFile(moderator, f.id)).toBeNull(); // moderators lack payments.review
    expect(await files.canReadFile(await sessionUser(owner), f.id)).not.toBeNull();
    expect(await files.canReadFile(await staff("ADMIN"), f.id)).not.toBeNull();
  });
});
