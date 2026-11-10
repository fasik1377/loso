import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { AppError, conflict, forbidden, notFound } from "@/lib/errors";
import { audit } from "@/lib/audit";
import { notify } from "@/lib/notifications";
import { getSettings } from "@/lib/settings";
import { applicantCanWithdraw, employerCanMove, employerCanSetJobStatus, jobAcceptsApplications } from "@/lib/domain/application";
import type { ApplicationStatus, JobStatus } from "@/lib/generated/prisma";
import type { Prisma } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { applicationSchema, jobSchema } from "@/lib/validation/schemas";
import { ensureConversation } from "./messaging";
import { slugify } from "@/lib/format";

type JobData = z.output<typeof jobSchema>;

/** Company the employer can post for (owner or member). */
export async function getEmployerCompany(userId: string) {
  return db.company.findFirst({
    where: { OR: [{ ownerId: userId }, { members: { some: { userId } } }] },
    orderBy: { createdAt: "asc" },
  });
}

async function assertJobOwnership(user: SessionUser, jobId: string) {
  const job = await db.job.findUnique({ where: { id: jobId }, include: { company: { include: { members: true } } } });
  if (!job) throw notFound("Job not found.");
  const member = job.company.ownerId === user.id || job.company.members.some((m) => m.userId === user.id);
  if (!member) throw forbidden();
  return job;
}

function jobFields(d: JobData) {
  return {
    title: d.title,
    categoryId: d.categoryId ?? null,
    description: d.description,
    responsibilities: d.responsibilities ?? null,
    qualifications: d.qualifications ?? null,
    employmentType: d.employmentType,
    experienceLevel: d.experienceLevel,
    workplaceType: d.workplaceType,
    locationId: d.locationId ?? null,
    salaryMinMinor: d.salaryMin ?? null,
    salaryMaxMinor: d.salaryMax ?? null,
    salaryVisible: d.salaryVisible,
    vacancies: d.vacancies,
    deadline: d.deadline ?? null,
    applicationMethod: d.applicationMethod,
    applicationEmail: d.applicationMethod === "EMAIL" ? (d.applicationEmail ?? null) : null,
    applicationUrl: d.applicationMethod === "EXTERNAL_URL" ? (d.applicationUrl ?? null) : null,
  };
}

/** Returns the status a "publish" request actually results in, given company approval + moderation policy. */
async function publishTarget(companyStatus: string): Promise<JobStatus> {
  const settings = await getSettings();
  if (settings.requireCompanyApprovalToPublish && companyStatus !== "APPROVED") {
    throw new AppError("Your company must be verified before you can publish jobs. Submit your documents on the Company page.");
  }
  if (companyStatus === "SUSPENDED" || companyStatus === "REJECTED") throw forbidden("Your company cannot publish jobs.");
  return settings.requireJobReview ? "PENDING_REVIEW" : "PUBLISHED";
}

/**
 * Staff post a vacancy on behalf of an approved employer, or for a new employer profile they
 * create (owned by the staff member, so applications reach them). The job is attributed to the
 * company owner, so the employer receives applications in their own dashboard.
 */
export async function createStaffJob(
  actor: SessionUser,
  d: JobData,
  publish: boolean,
  target: { companyId?: string; newCompanyName?: string },
) {
  if (d.deadline && d.deadline < new Date()) throw new AppError("The deadline must be in the future.");
  const name = target.newCompanyName?.trim();
  if (!name && !target.companyId) throw new AppError("Choose an employer or enter a new employer name.");

  return db.$transaction(async (tx) => {
    let company;
    if (name) {
      company = await tx.company.create({
        data: {
          ownerId: actor.id,
          name,
          slug: `${slugify(name) || "employer"}-${Date.now().toString(36)}`,
          status: "APPROVED",
          verifiedAt: new Date(),
          verifiedById: actor.id,
          members: { create: { userId: actor.id, role: "OWNER" } },
        },
      });
      // Lets the staff member manage applicants for this employer from the employer dashboard.
      await tx.userRole.upsert({ where: { userId_role: { userId: actor.id, role: "EMPLOYER" } }, create: { userId: actor.id, role: "EMPLOYER", grantedById: actor.id }, update: {} });
      await audit({ actorId: actor.id, action: "company.staff_create", entityType: "Company", entityId: company.id, metadata: { name } }, tx);
    } else {
      company = await tx.company.findUnique({ where: { id: target.companyId! } });
      if (!company) throw notFound("Employer not found.");
      if (company.status !== "APPROVED") throw conflict("Jobs can only be posted for verified employers.");
    }

    const status: JobStatus = publish ? "PUBLISHED" : "DRAFT";
    const job = await tx.job.create({
      data: {
        ...jobFields(d),
        companyId: company.id,
        postedById: company.ownerId,
        status,
        publishedAt: status === "PUBLISHED" ? new Date() : null,
        skills: { create: d.skillIds.map((skillId) => ({ skillId })) },
        questions: { create: d.questions.map((prompt, i) => ({ prompt, sortOrder: i })) },
      },
    });
    await audit({ actorId: actor.id, action: "job.staff_create", entityType: "Job", entityId: job.id, metadata: { companyId: company.id, status } }, tx);
    if (company.ownerId !== actor.id) {
      await notify({ userId: company.ownerId, type: "JOB", title: `Looso posted a job for ${company.name}: ${job.title}`, body: "Applications will appear in your employer dashboard.", link: `/jobs/${job.id}` }, tx);
    }
    return job;
  });
}

export async function createJob(user: SessionUser, d: JobData, publish: boolean) {
  const company = await getEmployerCompany(user.id);
  if (!company) throw new AppError("Create your company profile first.");
  if (d.deadline && d.deadline < new Date()) throw new AppError("The deadline must be in the future.");
  const status: JobStatus = publish ? await publishTarget(company.status) : "DRAFT";
  const job = await db.job.create({
    data: {
      ...jobFields(d),
      companyId: company.id,
      postedById: user.id,
      status,
      publishedAt: status === "PUBLISHED" ? new Date() : null,
      skills: { create: d.skillIds.map((skillId) => ({ skillId })) },
      questions: { create: d.questions.map((prompt, i) => ({ prompt, sortOrder: i })) },
    },
  });
  await audit({ actorId: user.id, action: "job.create", entityType: "Job", entityId: job.id, metadata: { status } });
  return job;
}

export async function updateJob(user: SessionUser, jobId: string, d: JobData) {
  const job = await assertJobOwnership(user, jobId);
  if (job.status === "REMOVED") throw forbidden("This job was removed by moderators.");
  await db.$transaction([
    db.job.update({ where: { id: jobId }, data: jobFields(d) }),
    db.jobSkill.deleteMany({ where: { jobId } }),
    db.jobSkill.createMany({ data: d.skillIds.map((skillId) => ({ jobId, skillId })) }),
  ]);
  // Questions are only editable before anyone applied (answers reference them).
  const applied = await db.jobApplication.count({ where: { jobId } });
  if (applied === 0) {
    await db.$transaction([
      db.jobQuestion.deleteMany({ where: { jobId } }),
      db.jobQuestion.createMany({ data: d.questions.map((prompt, i) => ({ jobId, prompt, sortOrder: i })) }),
    ]);
  }
}

export async function setJobStatus(user: SessionUser, jobId: string, requested: JobStatus) {
  const job = await assertJobOwnership(user, jobId);
  let to = requested;
  if (!employerCanSetJobStatus(job.status, requested)) throw conflict(`Cannot change a ${job.status.toLowerCase()} job to ${requested.toLowerCase()}.`);
  if (requested === "PUBLISHED") {
    if (job.deadline && job.deadline < new Date()) throw new AppError("Set a future deadline before publishing or renewing this job.");
    to = job.status === "PAUSED" ? "PUBLISHED" : await publishTarget(job.company.status);
  }
  await db.job.update({
    where: { id: jobId },
    data: {
      status: to,
      publishedAt: to === "PUBLISHED" && !job.publishedAt ? new Date() : undefined,
      closedAt: to === "CLOSED" ? new Date() : to === "PUBLISHED" ? null : undefined,
    },
  });
  await audit({ actorId: user.id, action: "job.status", entityType: "Job", entityId: jobId, metadata: { from: job.status, to } });
}

/** Public listing filter: published jobs whose deadline hasn't passed and whose company is in good standing. */
export function publicJobWhere(now: Date = new Date()): Prisma.JobWhereInput {
  return {
    status: "PUBLISHED",
    OR: [{ deadline: null }, { deadline: { gte: now } }],
    company: { status: { notIn: ["SUSPENDED", "REJECTED"] } },
  };
}

export const jobCompanySelect = { id: true, name: true, status: true, logoFileId: true, isDemo: true } satisfies Prisma.CompanySelect;

export interface JobSearch {
  q?: string;
  type?: string;
  location?: string;
  category?: string;
  level?: string;
  minSalary?: number;
  page?: number;
}

export async function searchJobs(s: JobSearch, pageSize = 12) {
  const and: Prisma.JobWhereInput[] = [publicJobWhere()];
  if (s.q) {
    and.push({
      OR: [
        { title: { contains: s.q, mode: "insensitive" } },
        { description: { contains: s.q, mode: "insensitive" } },
        { company: { name: { contains: s.q, mode: "insensitive" } } },
        { skills: { some: { skill: { name: { contains: s.q, mode: "insensitive" } } } } },
      ],
    });
  }
  if (s.type) and.push({ employmentType: s.type as Prisma.JobWhereInput["employmentType"] });
  if (s.level) and.push({ experienceLevel: s.level as Prisma.JobWhereInput["experienceLevel"] });
  if (s.location) and.push({ OR: [{ location: { slug: s.location } }, { location: { parent: { slug: s.location } } }] });
  if (s.category) and.push({ category: { slug: s.category } });
  if (s.minSalary) and.push({ salaryVisible: true, OR: [{ salaryMaxMinor: { gte: s.minSalary } }, { salaryMinMinor: { gte: s.minSalary } }] });
  const where: Prisma.JobWhereInput = { AND: and };
  const page = Math.max(1, s.page ?? 1);
  const [total, jobs] = await Promise.all([
    db.job.count({ where }),
    db.job.findMany({
      where,
      include: { company: { select: jobCompanySelect }, location: true, category: true },
      orderBy: [{ isFeatured: "desc" }, { publishedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, jobs, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

// ─── Applications ────────────────────────────────────────────────────────────

export async function applyToJob(user: SessionUser, d: z.output<typeof applicationSchema>) {
  if (!user.roles.includes("WORKER")) throw forbidden("Only job seeker accounts can apply for jobs.");
  const job = await db.job.findUnique({ where: { id: d.jobId }, include: { questions: true, company: true } });
  if (!job) throw notFound("Job not found.");
  const accepts = jobAcceptsApplications(job);
  if (!accepts.ok) throw conflict(accepts.reason);
  if (job.company.ownerId === user.id) throw forbidden("You cannot apply to your own job.");

  if (d.resumeId) {
    const resume = await db.resume.findFirst({ where: { id: d.resumeId, userId: user.id } });
    if (!resume) throw forbidden("Choose one of your own CVs.");
  }
  const answers = job.questions.map((q) => ({ questionId: q.id, prompt: q.prompt, answer: d.answers[q.id] ?? "" }));
  const missing = job.questions.find((q) => q.required && !d.answers[q.id]);
  if (missing) throw new AppError(`Please answer: ${missing.prompt}`);

  const existing = await db.jobApplication.findUnique({ where: { jobId_applicantId: { jobId: job.id, applicantId: user.id } } });
  if (existing) throw conflict("You have already applied to this job.");

  return db.$transaction(async (tx) => {
    const app = await tx.jobApplication.create({
      data: { jobId: job.id, applicantId: user.id, resumeId: d.resumeId ?? null, coverLetter: d.coverLetter ?? null, answers },
    });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, toStatus: "SUBMITTED" } });
    await notify({ userId: job.postedById, type: "APPLICATION", title: `New application for ${job.title}`, body: user.fullName, link: `/employer/applicants?job=${job.id}` }, tx);
    return app;
  });
}

export async function withdrawApplication(user: SessionUser, applicationId: string) {
  const app = await db.jobApplication.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app || app.applicantId !== user.id) throw notFound();
  if (!applicantCanWithdraw(app.status)) throw conflict("This application can no longer be withdrawn.");
  await db.$transaction(async (tx) => {
    await tx.jobApplication.update({ where: { id: app.id }, data: { status: "WITHDRAWN" } });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, fromStatus: app.status, toStatus: "WITHDRAWN" } });
    await notify({ userId: app.job.postedById, type: "APPLICATION", title: `An applicant withdrew from ${app.job.title}`, link: `/employer/applicants?job=${app.jobId}` }, tx);
  });
}

export async function updateApplicationStatus(
  user: SessionUser,
  applicationId: string,
  to: ApplicationStatus,
  extra: { note?: string; interviewAt?: Date; interviewDetails?: string },
) {
  const app = await db.jobApplication.findUnique({ where: { id: applicationId }, include: { job: true } });
  if (!app) throw notFound();
  await assertJobOwnership(user, app.jobId);
  if (!employerCanMove(app.status, to)) throw conflict(`Cannot move an application from ${app.status} to ${to}.`);
  if (to === "INTERVIEW" && !extra.interviewAt) throw new AppError("Choose the interview date and time.");

  await db.$transaction(async (tx) => {
    await tx.jobApplication.update({
      where: { id: app.id },
      data: {
        status: to,
        interviewAt: to === "INTERVIEW" ? extra.interviewAt : undefined,
        interviewDetails: to === "INTERVIEW" ? (extra.interviewDetails ?? null) : undefined,
      },
    });
    await tx.applicationEvent.create({ data: { applicationId: app.id, actorId: user.id, fromStatus: app.status, toStatus: to, note: extra.note } });
    await notify(
      {
        userId: app.applicantId,
        type: "APPLICATION",
        title: `Application update: ${app.job.title}`,
        body: `Your application status is now ${to.replace("_", " ").toLowerCase()}.${to === "INTERVIEW" && extra.interviewAt ? ` Interview: ${extra.interviewAt.toISOString().slice(0, 16).replace("T", " ")}` : ""}`,
        link: "/dashboard/applications",
      },
      tx,
    );
  });
}

export async function startApplicationConversation(user: SessionUser, applicationId: string) {
  const app = await db.jobApplication.findUnique({ where: { id: applicationId } });
  if (!app) throw notFound();
  if (app.applicantId !== user.id) await assertJobOwnership(user, app.jobId);
  const job = await db.job.findUniqueOrThrow({ where: { id: app.jobId } });
  return ensureConversation([app.applicantId, job.postedById], { jobApplicationId: app.id });
}

/** Moderation: staff can remove or restore any job. */
export async function moderateJob(actor: SessionUser, jobId: string, action: "remove" | "restore" | "approve" | "reject" | "feature" | "unfeature", note?: string) {
  const job = await db.job.findUnique({ where: { id: jobId } });
  if (!job) throw notFound();
  const data: Prisma.JobUpdateInput = {};
  if (action === "remove") Object.assign(data, { status: "REMOVED", moderationNote: note ?? null });
  if (action === "restore") Object.assign(data, { status: "CLOSED", moderationNote: null });
  if (action === "approve") {
    if (job.status !== "PENDING_REVIEW") throw conflict("Only jobs pending review can be approved.");
    Object.assign(data, { status: "PUBLISHED", publishedAt: new Date() });
  }
  if (action === "reject") {
    if (job.status !== "PENDING_REVIEW") throw conflict("Only jobs pending review can be rejected.");
    Object.assign(data, { status: "REJECTED", moderationNote: note ?? null });
  }
  if (action === "feature") Object.assign(data, { isFeatured: true });
  if (action === "unfeature") Object.assign(data, { isFeatured: false });
  await db.$transaction(async (tx) => {
    await tx.job.update({ where: { id: jobId }, data });
    await audit({ actorId: actor.id, action: `job.${action}`, entityType: "Job", entityId: jobId, metadata: { note: note ?? null } }, tx);
    if (["remove", "approve", "reject"].includes(action)) {
      await notify({ userId: job.postedById, type: "JOB", title: `Your job "${job.title}" was ${action === "remove" ? "removed" : action + "d"}`, body: note, link: "/employer/jobs" }, tx);
    }
  });
}
