import type { Metadata } from "next";
import Link from "next/link";
import { requireRolePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { areaLocations } from "@/lib/services/taxonomy";
import { fileUrl } from "@/lib/services/files";
import { formatDateTime } from "@/lib/format";
import { Alert, Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { StatusBadge } from "@/components/ui/status";
import { CompanyForm, CompanyVerificationForm } from "./forms";

export const metadata: Metadata = { title: "Company profile" };

export default async function CompanyPage() {
  const user = await requireRolePage("EMPLOYER");
  const company = await db.company.findFirst({
    where: { ownerId: user.id },
    include: { verifications: { orderBy: { createdAt: "desc" }, take: 1 } },
  });
  if (!company) return <EmptyState title="No company found" description="Contact support to set up your company." />;
  const locations = await areaLocations();
  const latest = company.verifications[0];

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Company profile" description="Shown on your job posts and public company page." actions={<Link href={`/companies/${company.id}`} className="text-sm font-semibold text-brand hover:underline">View public page</Link>} />

      <Card>
        <CardBody className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-semibold text-ink">Verification</h2>
            <StatusBadge status={company.status} />
          </div>
          {company.status === "APPROVED" ? (
            <p className="text-sm text-success">Your company is verified. You can publish jobs.</p>
          ) : company.status === "SUSPENDED" ? (
            <Alert tone="danger" title="Company suspended">{company.statusReason ?? "Contact support."}</Alert>
          ) : latest?.status === "SUBMITTED" ? (
            <Alert>Documents submitted {formatDateTime(latest.createdAt)}. Our team is reviewing them.</Alert>
          ) : (
            <>
              {latest?.reviewerNote && <Alert tone={latest.status === "REJECTED" ? "danger" : "warning"} title="Reviewer note">{latest.reviewerNote}</Alert>}
              <p className="text-sm text-muted">Upload your business license or registration certificate. Documents are private and seen only by verification staff.</p>
              <CompanyVerificationForm />
            </>
          )}
        </CardBody>
      </Card>

      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold text-ink">Company details</h2>
          <CompanyForm
            locations={locations.map((l) => ({ value: l.id, label: l.label }))}
            defaults={{
              name: company.name,
              description: company.description ?? "",
              industry: company.industry ?? "",
              address: company.address ?? "",
              locationId: company.locationId ?? "",
              phone: company.phone ?? "",
              email: company.email ?? "",
              website: company.website ?? "",
              logoUrl: fileUrl(company.logoFileId),
            }}
          />
        </CardBody>
      </Card>
    </div>
  );
}
