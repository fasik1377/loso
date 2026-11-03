"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { AppError, type ActionResult } from "@/lib/errors";
import { assertActive, assertUser } from "@/lib/auth/guards";
import { rateLimit } from "@/lib/rate-limit";
import { submitManualPayment, submitVerification } from "@/lib/services/accounts";
import { formFile, saveUpload } from "@/lib/services/files";
import { manualPaymentSchema } from "@/lib/validation/schemas";
import { db } from "@/lib/db";
import type { DocumentKind } from "@/lib/generated/prisma";
import { invalid, safeAction } from "./safe";

/** Pending users may only reach these two actions (plus logout) before activation. */
export async function submitPaymentAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertUser();
    if (user.status !== "PENDING") throw new AppError("Your account is not awaiting registration.");
    await rateLimit(`payment:${user.id}`, 5, 60 * 60);
    const parsed = manualPaymentSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    const proof = formFile(form, "proof");
    const proofFileId = proof ? await saveUpload(proof, "PAYMENT_PROOF", user.id) : null;
    await submitManualPayment(user.id, { ...parsed.data, proofFileId });
    revalidatePath("/account-status");
    return { ok: true, message: "Payment details submitted. Our team will verify them." };
  });
}

const docKinds = z.enum(["NATIONAL_ID", "KEBELE_ID", "PASSPORT", "DRIVING_LICENSE"]);

export async function submitVerificationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertUser();
    if (user.status !== "PENDING") throw new AppError("Your account is not awaiting verification.");
    await rateLimit(`verify:${user.id}`, 5, 60 * 60);
    const kind = docKinds.safeParse(form.get("idKind"));
    if (!kind.success) return { ok: false, error: "Choose the type of identity document.", fieldErrors: { idKind: ["Required"] } };
    const idFile = formFile(form, "idDocument");
    if (!idFile) return { ok: false, error: "Upload your identity document.", fieldErrors: { idDocument: ["Required"] } };
    const note = String(form.get("note") ?? "").trim().slice(0, 1000) || undefined;

    const documents: { fileId: string; kind: DocumentKind }[] = [{ fileId: await saveUpload(idFile, "ID_DOCUMENT", user.id), kind: kind.data }];
    const cert = formFile(form, "certificate");
    if (cert) documents.push({ fileId: await saveUpload(cert, "CERTIFICATE", user.id), kind: "CERTIFICATE" });
    await submitVerification(user.id, { documents, note });
    revalidatePath("/account-status");
    return { ok: true, message: "Documents submitted for review." };
  });
}

/** Employers submit company documents for verification (account is already active). */
export async function submitCompanyVerificationAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertActive();
    await rateLimit(`cverify:${user.id}`, 5, 60 * 60);
    const company = await db.company.findFirst({ where: { ownerId: user.id } });
    if (!company) throw new AppError("Create your company profile first.");
    if (company.status === "APPROVED") throw new AppError("Your company is already verified.");
    const pending = await db.verificationSubmission.count({ where: { companyId: company.id, status: "SUBMITTED" } });
    if (pending) throw new AppError("Your documents are already waiting for review.");
    const license = formFile(form, "license");
    if (!license) return { ok: false, error: "Upload your business license or registration document.", fieldErrors: { license: ["Required"] } };
    const fileId = await saveUpload(license, "COMPANY_DOCUMENT", user.id);
    const note = String(form.get("note") ?? "").trim().slice(0, 1000) || null;
    await db.verificationSubmission.create({
      data: { userId: user.id, companyId: company.id, applicantNote: note, documents: { create: [{ fileId, kind: "BUSINESS_LICENSE" }] } },
    });
    if (company.status === "REJECTED") await db.company.update({ where: { id: company.id }, data: { status: "PENDING_REVIEW" } });
    revalidatePath("/employer/company");
    return { ok: true, message: "Company documents submitted for review." };
  });
}
