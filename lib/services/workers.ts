import "server-only";
import type { z } from "zod";
import { db } from "@/lib/db";
import { notFound } from "@/lib/errors";
import type { Prisma } from "@/lib/generated/prisma";
import type { ContactVisibility } from "@/lib/generated/prisma";
import type { SessionUser } from "@/lib/auth/session";
import type { profileSchema, workerProfileSchema, workerServiceSchema } from "@/lib/validation/schemas";

/** Public worker listing: active accounts that offer services. Verified = activated by staff after document review. */
export function publicWorkerWhere(): Prisma.WorkerProfileWhereInput {
  return { offersServices: true, user: { status: "ACTIVE" } };
}

/** Fields needed to render a worker card, including whether identity verification was approved. */
export const workerUserSelect = {
  id: true,
  fullName: true,
  isDemo: true,
  profile: { select: { avatarFileId: true } },
  verifications: { where: { status: "APPROVED", companyId: null }, select: { id: true }, take: 1 },
} satisfies Prisma.UserSelect;

export interface WorkerSearch {
  q?: string;
  category?: string;
  location?: string;
  minRating?: number;
  available?: boolean;
  maxPrice?: number;
  page?: number;
}

export async function searchWorkers(s: WorkerSearch, pageSize = 12) {
  const and: Prisma.WorkerProfileWhereInput[] = [publicWorkerWhere()];
  if (s.q) {
    and.push({
      OR: [
        { user: { fullName: { contains: s.q, mode: "insensitive" } } },
        { headline: { contains: s.q, mode: "insensitive" } },
        { services: { some: { active: true, title: { contains: s.q, mode: "insensitive" } } } },
        { skills: { some: { skill: { name: { contains: s.q, mode: "insensitive" } } } } },
      ],
    });
  }
  if (s.category) and.push({ services: { some: { active: true, category: { slug: s.category, active: true } } } });
  if (s.location) and.push({ areas: { some: { OR: [{ location: { slug: s.location } }, { location: { parent: { slug: s.location } } }] } } });
  if (s.minRating) and.push({ ratingAverage: { gte: s.minRating } });
  if (s.available) and.push({ availability: "AVAILABLE" });
  if (s.maxPrice) and.push({ OR: [{ priceMinMinor: null }, { priceMinMinor: { lte: s.maxPrice } }] });
  const where: Prisma.WorkerProfileWhereInput = { AND: and };
  const page = Math.max(1, s.page ?? 1);
  const [total, workers] = await Promise.all([
    db.workerProfile.count({ where }),
    db.workerProfile.findMany({
      where,
      include: {
        user: { select: workerUserSelect },
        services: { where: { active: true }, include: { category: true }, take: 3 },
        areas: { include: { location: true }, take: 3 },
      },
      orderBy: [{ ratingAverage: "desc" }, { completedCount: "desc" }, { updatedAt: "desc" }],
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
  ]);
  return { total, workers, page, pages: Math.max(1, Math.ceil(total / pageSize)) };
}

/**
 * Phone numbers are not public by default. The owner chooses who can see them:
 * HIDDEN (in-app messages only), CONNECTIONS (people with an accepted request/active application),
 * or REGISTERED_USERS (any active signed-in user).
 */
export async function canSeeContact(viewer: SessionUser | null, ownerId: string, visibility: ContactVisibility): Promise<boolean> {
  if (!viewer || viewer.status !== "ACTIVE") return false;
  if (viewer.id === ownerId) return true;
  if (visibility === "HIDDEN") return false;
  if (visibility === "REGISTERED_USERS") return true;
  const [requests, applications] = await Promise.all([
    db.serviceRequest.count({
      where: {
        status: { in: ["ACCEPTED", "IN_PROGRESS", "COMPLETED"] },
        OR: [
          { customerId: viewer.id, workerId: ownerId },
          { customerId: ownerId, workerId: viewer.id },
        ],
      },
    }),
    db.jobApplication.count({
      where: {
        status: { in: ["SHORTLISTED", "INTERVIEW", "OFFERED", "HIRED"] },
        OR: [
          { applicantId: ownerId, job: { postedById: viewer.id } },
          { applicantId: viewer.id, job: { postedById: ownerId } },
        ],
      },
    }),
  ]);
  return requests + applications > 0;
}

export async function getPublicWorker(userId: string) {
  const user = await db.user.findUnique({
    where: { id: userId },
    include: {
      profile: { include: { location: true } },
      workerProfile: {
        include: {
          skills: { include: { skill: true } },
          services: { where: { active: true }, include: { category: true } },
          areas: { include: { location: true } },
          portfolio: { orderBy: { createdAt: "desc" } },
        },
      },
      reviewsReceived: {
        where: { status: "VISIBLE" },
        orderBy: { createdAt: "desc" },
        take: 20,
        include: { author: { select: { fullName: true } }, serviceRequest: { select: { category: { select: { name: true } } } } },
      },
    },
  });
  if (!user || user.status !== "ACTIVE" || !user.workerProfile) throw notFound("Worker not found.");
  return user;
}

export async function updateProfile(userId: string, d: z.output<typeof profileSchema>, avatarFileId?: string) {
  await db.$transaction([
    db.user.update({ where: { id: userId }, data: { fullName: d.fullName, email: d.email ?? null } }),
    db.userProfile.upsert({
      where: { userId },
      create: { userId, bio: d.bio, locationId: d.locationId ?? null, languages: d.languages, phoneVisibility: d.phoneVisibility, ...(avatarFileId ? { avatarFileId } : {}) },
      update: { bio: d.bio ?? null, locationId: d.locationId ?? null, languages: d.languages, phoneVisibility: d.phoneVisibility, ...(avatarFileId ? { avatarFileId } : {}) },
    }),
  ]);
}

export async function updateWorkerProfile(userId: string, d: z.output<typeof workerProfileSchema>) {
  const wp = await db.workerProfile.findUnique({ where: { userId } });
  if (!wp) throw notFound("Worker profile not found.");
  // Only accept ids that exist and are active (ignore anything else a client might post).
  const [skills, areas] = await Promise.all([
    db.skill.findMany({ where: { id: { in: d.skillIds }, active: true }, select: { id: true } }),
    db.location.findMany({ where: { id: { in: d.areaIds }, active: true }, select: { id: true } }),
  ]);
  await db.$transaction([
    db.workerProfile.update({
      where: { id: wp.id },
      data: {
        headline: d.headline ?? null,
        seeksJobs: d.seeksJobs,
        offersServices: d.offersServices,
        yearsExperience: d.yearsExperience ?? null,
        experienceSummary: d.experienceSummary ?? null,
        qualifications: d.qualifications ?? null,
        availability: d.availability,
        availabilityNote: d.availabilityNote ?? null,
        pricingMethod: d.pricingMethod,
        priceMinMinor: d.priceMin ?? null,
        priceMaxMinor: d.priceMax ?? null,
      },
    }),
    db.workerSkill.deleteMany({ where: { workerId: wp.id } }),
    db.workerSkill.createMany({ data: skills.map((s) => ({ workerId: wp.id, skillId: s.id })) }),
    db.serviceArea.deleteMany({ where: { workerId: wp.id } }),
    db.serviceArea.createMany({ data: areas.map((a) => ({ workerId: wp.id, locationId: a.id })) }),
  ]);
}

export async function upsertWorkerService(userId: string, d: z.output<typeof workerServiceSchema>) {
  const wp = await db.workerProfile.findUnique({ where: { userId } });
  if (!wp) throw notFound("Worker profile not found.");
  const category = await db.serviceCategory.findFirst({ where: { id: d.categoryId, active: true } });
  if (!category) throw notFound("Category not found.");
  const fields = {
    title: d.title,
    description: d.description ?? null,
    pricingMethod: d.pricingMethod,
    priceMinMinor: d.priceMin ?? null,
    priceMaxMinor: d.priceMax ?? null,
    active: true,
  };
  await db.workerService.upsert({
    where: { workerId_categoryId: { workerId: wp.id, categoryId: d.categoryId } },
    create: { workerId: wp.id, categoryId: d.categoryId, ...fields },
    update: fields,
  });
  if (!wp.offersServices) await db.workerProfile.update({ where: { id: wp.id }, data: { offersServices: true } });
}

export async function removeWorkerService(userId: string, serviceId: string) {
  const res = await db.workerService.deleteMany({ where: { id: serviceId, worker: { userId } } });
  if (res.count === 0) throw notFound();
}
