import type { ApplicationStatus, JobStatus } from "@/lib/generated/prisma";

/** Employer-driven pipeline. Applicants may only withdraw. Final states cannot be reopened. */
const EMPLOYER_TRANSITIONS: Record<ApplicationStatus, ApplicationStatus[]> = {
  SUBMITTED: ["UNDER_REVIEW", "SHORTLISTED", "REJECTED"],
  UNDER_REVIEW: ["SHORTLISTED", "INTERVIEW", "REJECTED"],
  SHORTLISTED: ["INTERVIEW", "OFFERED", "REJECTED"],
  INTERVIEW: ["OFFERED", "REJECTED", "SHORTLISTED"],
  OFFERED: ["HIRED", "REJECTED"],
  HIRED: [],
  REJECTED: [],
  WITHDRAWN: [],
};

export function employerCanMove(from: ApplicationStatus, to: ApplicationStatus): boolean {
  return EMPLOYER_TRANSITIONS[from].includes(to);
}

export function employerNextStatuses(from: ApplicationStatus): ApplicationStatus[] {
  return EMPLOYER_TRANSITIONS[from];
}

export function applicantCanWithdraw(status: ApplicationStatus): boolean {
  return !["HIRED", "REJECTED", "WITHDRAWN"].includes(status);
}

/** A job accepts applications only when published, in-app, and before its deadline. */
export function jobAcceptsApplications(
  job: { status: JobStatus; deadline: Date | null; applicationMethod: string },
  now: Date = new Date(),
): { ok: true } | { ok: false; reason: string } {
  if (job.status !== "PUBLISHED") return { ok: false, reason: "This job is not accepting applications." };
  if (job.deadline && job.deadline.getTime() < now.getTime()) return { ok: false, reason: "The application deadline has passed." };
  if (job.applicationMethod !== "IN_APP") return { ok: false, reason: "This employer accepts applications outside Loso." };
  return { ok: true };
}

/** Allowed employer job status changes. Publishing also requires an approved company (checked in the service). */
const JOB_TRANSITIONS: Record<JobStatus, JobStatus[]> = {
  DRAFT: ["PUBLISHED", "PENDING_REVIEW", "CLOSED"],
  PENDING_REVIEW: ["DRAFT", "CLOSED"],
  PUBLISHED: ["PAUSED", "CLOSED"],
  PAUSED: ["PUBLISHED", "CLOSED"],
  CLOSED: ["PUBLISHED"], // "renew" (requires a future deadline)
  REJECTED: ["DRAFT"],
  REMOVED: [],
};

export function employerCanSetJobStatus(from: JobStatus, to: JobStatus): boolean {
  return JOB_TRANSITIONS[from].includes(to);
}
