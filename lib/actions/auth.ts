"use server";

import { redirect } from "next/navigation";
import type { ActionResult } from "@/lib/errors";
import { createSession, destroySession, getCurrentUser } from "@/lib/auth/session";
import { homePathFor } from "@/lib/auth/guards";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { authenticate, changePassword, createPasswordReset, registerUser, resetPassword } from "@/lib/services/auth";
import { forgotPasswordSchema, loginSchema, passwordSchema, registerSchema, resetPasswordSchema, type RegisterInput } from "@/lib/validation/schemas";
import { invalid, safeAction } from "./safe";
import { assertUser } from "@/lib/auth/guards";
import { z } from "zod";

export async function registerAction(input: RegisterInput): Promise<ActionResult> {
  return safeAction(async () => {
    await rateLimit(`register:${await clientIp()}`, 5, 60 * 60);
    const parsed = registerSchema.safeParse(input);
    if (!parsed.success) return invalid(parsed.error);
    const { userId } = await registerUser(parsed.data);
    await createSession(userId);
    redirect(parsed.data.accountType === "WORKER" ? "/account-status" : parsed.data.accountType === "EMPLOYER" ? "/employer/company" : "/dashboard");
  });
}

export async function loginAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const parsed = loginSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    const ip = await clientIp();
    await rateLimit(`login:ip:${ip}`, 20, 15 * 60);
    await rateLimit(`login:id:${parsed.data.phoneOrEmail.toLowerCase()}`, 10, 15 * 60);
    const userId = await authenticate(parsed.data.phoneOrEmail, parsed.data.password);
    await createSession(userId);
    const user = await getCurrentUser();
    const next = String(form.get("next") ?? "");
    // Only allow same-site relative redirects (prevents open redirect).
    const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : null;
    redirect(user?.status === "ACTIVE" && safeNext ? safeNext : homePathFor(user!));
  });
}

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

export async function forgotPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const parsed = forgotPasswordSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    await rateLimit(`forgot:${await clientIp()}`, 5, 60 * 60);
    const result = await createPasswordReset(parsed.data.phoneOrEmail);
    // No SMS/email provider is configured yet, so the link cannot be delivered automatically.
    // In development only, log it to the server console to allow testing the flow.
    if (result && process.env.NODE_ENV !== "production") {
      console.info(`[dev] password reset link: ${process.env.APP_URL ?? "http://localhost:3000"}/reset-password?token=${result.token}`);
    }
    // Same response whether or not the account exists.
    return {
      ok: true,
      message:
        "If an account matches, a reset link has been created. Automatic SMS/email delivery is not configured yet, so please contact Loso support to receive your link through a verified channel.",
    };
  });
}

export async function resetPasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const parsed = resetPasswordSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    await rateLimit(`reset:${await clientIp()}`, 10, 60 * 60);
    await resetPassword(parsed.data.token, parsed.data.password);
    redirect("/login?reset=1");
  });
}

const changePasswordSchema = z
  .object({ current: z.string().min(1), password: passwordSchema, confirmPassword: z.string() })
  .refine((d) => d.password === d.confirmPassword, { path: ["confirmPassword"], message: "Passwords do not match" });

export async function changePasswordAction(_: ActionResult | null, form: FormData): Promise<ActionResult> {
  return safeAction(async () => {
    const user = await assertUser();
    const parsed = changePasswordSchema.safeParse(Object.fromEntries(form));
    if (!parsed.success) return invalid(parsed.error);
    await rateLimit(`chpw:${user.id}`, 5, 15 * 60);
    await changePassword(user.id, parsed.data.current, parsed.data.password);
    return { ok: true, message: "Password updated." };
  });
}
