import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/guards";
import { ProsePage } from "@/components/layout/prose-page";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Verification" };

/** Explains the verification process; pending users are sent to their status page to act on it. */
export default async function VerifyPage() {
  const user = await requireUserPage();
  if (user.status === "PENDING") redirect("/account-status");
  return (
    <ProsePage title="How verification works" intro="Loso verifies workers and employers before they can use key features.">
      <h2>Workers</h2>
      <p>Workers pay a registration fee and upload an identity document. Staff confirm the payment and review the document as two separate checks; only when both pass is the account activated.</p>
      <h2>Employers</h2>
      <p>Employers upload a business license or registration document from the Company page. Jobs can be published once the company is verified.</p>
      <h2>Customers</h2>
      <p>Customer accounts are free and active immediately. Abuse is handled through reports and moderation.</p>
      <ButtonLink href={user.roles.includes("EMPLOYER") ? "/employer/company" : "/dashboard"}>Back to dashboard</ButtonLink>
    </ProsePage>
  );
}
