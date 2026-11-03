import type { Metadata } from "next";
import { requireRolePage } from "@/lib/auth/guards";
import { getEmployerCompany } from "@/lib/services/jobs";
import { areaLocations, jobCategories, skills } from "@/lib/services/taxonomy";
import { getSettings } from "@/lib/settings";
import { Card, CardBody, EmptyState, PageHeader } from "@/components/ui/primitives";
import { JobForm } from "../job-form";

export const metadata: Metadata = { title: "Post a job" };

export default async function NewJobPage() {
  const user = await requireRolePage("EMPLOYER");
  const [company, categories, locations, allSkills, settings] = await Promise.all([getEmployerCompany(user.id), jobCategories(), areaLocations(), skills(), getSettings()]);
  if (!company) return <EmptyState title="Create your company profile first" />;
  const canPublish = company.status === "APPROVED" || (!settings.requireCompanyApprovalToPublish && company.status === "PENDING_REVIEW");
  return (
    <div className="max-w-4xl">
      <PageHeader title="Post a job" description={settings.requireJobReview ? "Published jobs are reviewed by Loso before they appear publicly." : "Published jobs appear in search immediately."} />
      <Card>
        <CardBody>
          <JobForm
            categories={categories.map((c) => ({ value: c.id, label: c.name }))}
            locations={locations.map((l) => ({ value: l.id, label: l.label }))}
            skills={allSkills.map((s) => ({ value: s.id, label: s.name }))}
            canPublish={canPublish}
          />
        </CardBody>
      </Card>
    </div>
  );
}
