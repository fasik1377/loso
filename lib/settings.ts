import "server-only";
import { z } from "zod";
import { db } from "@/lib/db";

/**
 * Typed platform settings stored in the PlatformSetting table. Defaults apply until an admin
 * changes a value. The registration fee lives here — never hardcode it elsewhere.
 */
export const settingsSchema = z.object({
  registrationFeeMinor: z.number().int().min(0).max(100_000_00),
  registrationFeeCurrency: z.string().length(3),
  manualPaymentInstructions: z.string().max(2000),
  requireCompanyApprovalToPublish: z.boolean(),
  requireJobReview: z.boolean(),
  maxActiveServiceRequestsPerCustomer: z.number().int().min(1).max(100),
  supportPhone: z.string().max(30),
  supportEmail: z.string().max(120),
});

export type PlatformSettings = z.infer<typeof settingsSchema>;

export const DEFAULT_SETTINGS: PlatformSettings = {
  // Placeholder until the operator sets the real fee in /admin/settings.
  registrationFeeMinor: 0,
  registrationFeeCurrency: "ETB",
  manualPaymentInstructions:
    "Payment instructions have not been configured yet. Please wait for an administrator to publish the official payment details before paying.",
  requireCompanyApprovalToPublish: true,
  requireJobReview: false,
  maxActiveServiceRequestsPerCustomer: 10,
  supportPhone: "",
  supportEmail: "",
};

export async function getSettings(): Promise<PlatformSettings> {
  const rows = await db.platformSetting.findMany();
  const merged: Record<string, unknown> = { ...DEFAULT_SETTINGS };
  for (const row of rows) if (row.key in DEFAULT_SETTINGS) merged[row.key] = row.value;
  const parsed = settingsSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_SETTINGS;
}

export async function feeIsConfigured(settings: PlatformSettings): Promise<boolean> {
  return settings.registrationFeeMinor > 0 && !settings.manualPaymentInstructions.startsWith("Payment instructions have not been configured");
}
