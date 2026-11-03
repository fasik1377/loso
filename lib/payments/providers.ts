import "server-only";

/**
 * Payment provider abstraction.
 *
 * Only the MANUAL provider is implemented: the payer transfers money through an official channel
 * published by the operator (bank / Telebirr merchant), then submits the transaction reference and
 * optional proof. Staff verify it against the real bank/wallet statement. Nothing is ever marked as
 * paid automatically.
 *
 * To add Chapa or Telebirr: implement `PaymentProvider` (initiate → hosted checkout URL,
 * verify → server-to-server status check, webhook signature validation) and register it below
 * behind its env credentials. Use PaymentTransaction.idempotencyKey as the provider tx_ref.
 */
export interface PaymentProvider {
  id: string;
  label: string;
  /** Automatic providers confirm payments via server callbacks; manual ones need staff review. */
  kind: "manual" | "automatic";
  isConfigured(): boolean;
}

export const manualProvider: PaymentProvider = {
  id: "manual",
  label: "Manual transfer (reviewed by Loso staff)",
  kind: "manual",
  isConfigured: () => true,
};

export const MANUAL_METHODS = [
  { id: "bank_transfer", label: "Bank transfer / deposit" },
  { id: "telebirr_transfer", label: "Telebirr transfer to merchant number" },
  { id: "cash_office", label: "Cash at Loso office (receipt number)" },
] as const;

export function availableProviders(): PaymentProvider[] {
  return [manualProvider].filter((p) => p.isConfigured());
}
