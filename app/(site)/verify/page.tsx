import { Suspense } from "react";
import { connection } from "next/server";
import { SitePageSkeleton } from "@/components/layout/site-page-skeleton";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireUserPage } from "@/lib/auth/guards";
import { ProsePage } from "@/components/layout/prose-page";
import { ButtonLink } from "@/components/ui/primitives";

export const metadata: Metadata = { title: "Verification" };

/** Explains the verification process; pending users are sent to their status page to act on it. */
async function VerifyPageContent() {
  await connection(); // live data: render per request
  const user = await requireUserPage();
  if (user.status === "PENDING") redirect("/account-status");
  return (
    <ProsePage title="How verification works" intro="An administrator verifies every job seeker and employer before they can use Loso.">
      <h2>Workers</h2>
      <p>Workers pay a registration fee and upload an identity document. Staff confirm the payment and review the document as two separate checks; only when both pass is the account activated.</p>
      <h2>Employers</h2>
      <p>Employers upload a business license or registration document after signing up. An administrator must verify it before the employer account can be used to post jobs.</p>
      <h2>Customers</h2>
      <p>Customer accounts are free and active immediately. Abuse is handled through reports and moderation.</p>
      <ButtonLink href={user.roles.includes("EMPLOYER") ? "/employer/company" : "/dashboard"}>Back to dashboard</ButtonLink>
    </ProsePage>
  );
}

// Live data streams in behind Suspense so navigation shows the page shell instantly.
export default function VerifyPage() {
  return (
    <Suspense fallback={<SitePageSkeleton />}>
      <VerifyPageContent />
    </Suspense>
  );
}
