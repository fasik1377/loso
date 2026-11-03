import { z } from "zod";
import { normalizePhone } from "@/lib/phone";

/*
 * Zod schemas shared by client forms (React Hook Form) and server actions.
 * The server ALWAYS re-validates; client validation is only for fast feedback.
 */

const trimmed = (max: number) => z.string().trim().max(max);
const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : undefined));

export const phoneSchema = z
  .string()
  .trim()
  .min(1, "Phone number is required")
  .transform((v, ctx) => {
    const p = normalizePhone(v);
    if (!p) {
      ctx.addIssue({ code: "custom", message: "Enter a valid Ethiopian phone number, e.g. 0911 234 567" });
      return z.NEVER;
    }
    return p;
  });

export const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters")
  .max(128, "Password is too long")
  .refine((v) => /[A-Za-z]/.test(v) && /\d/.test(v), "Use both letters and numbers");

const optionalEmail = z
  .string()
  .trim()
  .toLowerCase()
  .max(120)
  .optional()
  .transform((v) => (v ? v : undefined))
  .pipe(z.email("Enter a valid email address").optional());

export const registerSchema = z
  .object({
    accountType: z.enum(["WORKER", "CUSTOMER", "EMPLOYER"]),
    fullName: trimmed(100).min(2, "Enter your full name"),
    phone: phoneSchema,
    email: optionalEmail,
    password: passwordSchema,
    confirmPassword: z.string(),
    seeksJobs: z.boolean().default(false),
    offersServices: z.boolean().default(false),
    employerType: z.enum(["INDIVIDUAL", "COMPANY"]).optional(),
    companyName: optionalText(120),
    acceptTerms: z.literal(true, { error: "You must accept the terms and privacy policy" }),
  })
  .superRefine((d, ctx) => {
    if (d.password !== d.confirmPassword) ctx.addIssue({ code: "custom", path: ["confirmPassword"], message: "Passwords do not match" });
    if (d.accountType === "WORKER" && !d.seeksJobs && !d.offersServices) {
      ctx.addIssue({ code: "custom", path: ["offersServices"], message: "Choose at least one: find a job or offer services" });
    }
    if (d.accountType === "EMPLOYER" && !d.companyName) {
      ctx.addIssue({ code: "custom", path: ["companyName"], message: "Enter your company or business name" });
    }
  });
export type RegisterInput = z.input<typeof registerSchema>;

export const loginSchema = z.object({
  phoneOrEmail: z.string().trim().min(3, "Enter your phone number or email").max(120),
  password: z.string().min(1, "Enter your password").max(128),
});

export const forgotPasswordSchema = z.object({ phoneOrEmail: z.string().trim().min(3).max(120) });
export const resetPasswordSchema = z
  .object({ token: z.string().min(20).max(200), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export const manualPaymentSchema = z.object({
  method: z.enum(["bank_transfer", "telebirr_transfer", "cash_office"]),
  reference: trimmed(64)
    .min(4, "Enter the transaction reference from your receipt")
    .regex(/^[A-Za-z0-9\-_/]+$/, "Use only letters, numbers, - _ /"),
});

export const profileSchema = z.object({
  fullName: trimmed(100).min(2),
  email: optionalEmail,
  bio: optionalText(1000),
  locationId: optionalText(40),
  languages: z.array(trimmed(30)).max(8).default([]),
  phoneVisibility: z.enum(["HIDDEN", "CONNECTIONS", "REGISTERED_USERS"]),
});

const moneyMajor = z
  .union([z.string(), z.number()])
  .optional()
  .transform((v, ctx) => {
    if (v === undefined || v === "") return undefined;
    const n = Number(v);
    if (!Number.isFinite(n) || n < 0 || n > 10_000_000) {
      ctx.addIssue({ code: "custom", message: "Enter a valid amount" });
      return z.NEVER;
    }
    return Math.round(n * 100);
  });

export const workerProfileSchema = z
  .object({
    headline: optionalText(120),
    seeksJobs: z.boolean(),
    offersServices: z.boolean(),
    yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
    experienceSummary: optionalText(2000),
    qualifications: optionalText(2000),
    availability: z.enum(["AVAILABLE", "BUSY", "UNAVAILABLE"]),
    availabilityNote: optionalText(200),
    pricingMethod: z.enum(["HOURLY", "DAILY", "PER_JOB", "NEGOTIABLE"]),
    priceMin: moneyMajor,
    priceMax: moneyMajor,
    skillIds: z.array(z.string().max(40)).max(30).default([]),
    areaIds: z.array(z.string().max(40)).max(30).default([]),
  })
  .refine((d) => d.priceMin == null || d.priceMax == null || d.priceMin <= d.priceMax, {
    path: ["priceMax"],
    message: "Maximum must be at least the minimum",
  });

export const workerServiceSchema = z
  .object({
    categoryId: z.string().min(1, "Choose a category").max(40),
    title: trimmed(100).min(3, "Enter a short service title"),
    description: optionalText(1000),
    pricingMethod: z.enum(["HOURLY", "DAILY", "PER_JOB", "NEGOTIABLE"]),
    priceMin: moneyMajor,
    priceMax: moneyMajor,
  })
  .refine((d) => d.priceMin == null || d.priceMax == null || d.priceMin <= d.priceMax, {
    path: ["priceMax"],
    message: "Maximum must be at least the minimum",
  });

export const companySchema = z.object({
  name: trimmed(120).min(2),
  description: optionalText(3000),
  industry: optionalText(80),
  address: optionalText(200),
  locationId: optionalText(40),
  phone: z
    .string()
    .trim()
    .optional()
    .transform((v, ctx) => {
      if (!v) return undefined;
      const p = normalizePhone(v);
      if (!p) {
        ctx.addIssue({ code: "custom", message: "Enter a valid phone number" });
        return z.NEVER;
      }
      return p;
    }),
  email: optionalEmail,
  website: optionalText(200).pipe(z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }).optional()),
});

export const jobSchema = z
  .object({
    title: trimmed(120).min(3, "Enter a job title"),
    categoryId: optionalText(40),
    description: trimmed(8000).min(30, "Describe the job in at least 30 characters"),
    responsibilities: optionalText(5000),
    qualifications: optionalText(5000),
    employmentType: z.enum(["FULL_TIME", "PART_TIME", "CONTRACT", "TEMPORARY", "INTERNSHIP", "VOLUNTEER", "DAILY_LABOR"]),
    experienceLevel: z.enum(["ENTRY", "JUNIOR", "MID", "SENIOR", "MANAGER"]),
    workplaceType: z.enum(["ON_SITE", "REMOTE", "HYBRID"]),
    locationId: optionalText(40),
    salaryMin: moneyMajor,
    salaryMax: moneyMajor,
    salaryVisible: z.boolean(),
    vacancies: z.coerce.number().int().min(1).max(1000),
    deadline: z
      .string()
      .optional()
      .transform((v) => (v ? new Date(`${v}T23:59:59`) : undefined))
      .refine((d) => !d || !Number.isNaN(d.getTime()), "Enter a valid date"),
    applicationMethod: z.enum(["IN_APP", "EMAIL", "EXTERNAL_URL"]),
    applicationEmail: optionalEmail,
    applicationUrl: optionalText(300).pipe(z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" }).optional()),
    skillIds: z.array(z.string().max(40)).max(20).default([]),
    // Form-friendly shape ({ text }) for useFieldArray; blank entries are dropped.
    questions: z
      .array(z.object({ text: trimmed(300) }))
      .max(5)
      .default([])
      .transform((qs) => qs.map((q) => q.text).filter((t) => t.length > 0)),
  })
  .superRefine((d, ctx) => {
    if (d.salaryMin != null && d.salaryMax != null && d.salaryMin > d.salaryMax)
      ctx.addIssue({ code: "custom", path: ["salaryMax"], message: "Maximum must be at least the minimum" });
    if (d.applicationMethod === "EMAIL" && !d.applicationEmail)
      ctx.addIssue({ code: "custom", path: ["applicationEmail"], message: "Enter the email applicants should use" });
    if (d.applicationMethod === "EXTERNAL_URL" && !d.applicationUrl)
      ctx.addIssue({ code: "custom", path: ["applicationUrl"], message: "Enter the application link" });
  });
export type JobInput = z.input<typeof jobSchema>;

export const applicationSchema = z.object({
  jobId: z.string().min(1).max(40),
  resumeId: optionalText(40),
  coverLetter: optionalText(4000),
  answers: z.record(z.string(), trimmed(2000)).default({}),
});

export const serviceRequestSchema = z.object({
  workerId: z.string().min(1).max(40),
  categoryId: z.string().min(1, "Choose the service you need").max(40),
  title: trimmed(120).min(3, "Give the request a short title"),
  description: trimmed(3000).min(10, "Describe the task in a bit more detail"),
  preferredAt: z
    .string()
    .optional()
    .transform((v) => (v ? new Date(v) : undefined))
    .refine((d) => !d || !Number.isNaN(d.getTime()), "Enter a valid date and time"),
  locationId: optionalText(40),
  addressDetail: optionalText(200),
  budget: moneyMajor,
});
export type ServiceRequestInput = z.input<typeof serviceRequestSchema>;

export const reviewSchema = z.object({
  serviceRequestId: z.string().min(1).max(40),
  rating: z.coerce.number().int().min(1, "Choose a rating").max(5),
  comment: optionalText(1000),
});

export const messageSchema = z.object({
  conversationId: z.string().min(1).max(40),
  body: z.string().trim().min(1, "Message cannot be empty").max(2000, "Message is too long"),
});

export const reportSchema = z.object({
  targetType: z.enum(["USER", "JOB", "REVIEW", "MESSAGE", "ADVERTISEMENT", "SERVICE_REQUEST", "COMPANY"]),
  targetId: z.string().min(1).max(40),
  reason: z.enum(["FRAUD", "ABUSE", "HARASSMENT", "INAPPROPRIATE", "SPAM", "UNSAFE", "FAKE_PROFILE", "DISPUTE", "OTHER"]),
  details: optionalText(1000),
});

export const advertisementSchema = z
  .object({
    businessName: trimmed(120).min(2),
    contactPhone: optionalText(30),
    contactEmail: optionalEmail,
    title: trimmed(80).min(3),
    body: optionalText(200),
    destinationUrl: optionalText(300),
    startsAt: z.string().min(1, "Choose a start date").transform((v) => new Date(`${v}T00:00:00`)),
    endsAt: z.string().min(1, "Choose an end date").transform((v) => new Date(`${v}T23:59:59`)),
    slots: z.array(z.enum(["HOME", "JOBS", "SERVICES", "WORKER_PROFILE"])).min(1, "Choose at least one placement"),
  })
  .refine((d) => d.endsAt > d.startsAt, { path: ["endsAt"], message: "End date must be after the start date" });

export const categorySchema = z.object({
  name: trimmed(80).min(2),
  description: optionalText(300),
  icon: optionalText(40),
  sortOrder: z.coerce.number().int().min(0).max(10000),
});

export const decisionSchema = z.object({
  id: z.string().min(1).max(40),
  note: optionalText(1000),
});

export const contactSchema = z.object({
  name: trimmed(100).min(2),
  contact: trimmed(120).min(5, "Enter a phone number or email so we can reply"),
  subject: trimmed(120).min(3),
  message: trimmed(3000).min(10),
});

/** Convert FormData to a plain object, collecting repeated keys (checkbox groups) into arrays. */
export function formToObject(form: FormData, arrayKeys: string[] = [], boolKeys: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of form.entries()) {
    if (v instanceof File) continue;
    if (arrayKeys.includes(k)) (out[k] = (out[k] as string[] | undefined) ?? []), (out[k] as string[]).push(v);
    else out[k] = v;
  }
  for (const k of arrayKeys) out[k] ??= [];
  for (const k of boolKeys) out[k] = form.get(k) === "on" || form.get(k) === "true";
  return out;
}

export function fieldErrors(err: z.ZodError): Record<string, string[]> {
  return z.flattenError(err).fieldErrors as Record<string, string[]>;
}
