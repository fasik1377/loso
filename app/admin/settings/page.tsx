import type { Metadata } from "next";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { formatMoney } from "@/lib/money";
import { formatDateTime } from "@/lib/format";
import { announcementAction, saveSettingsAction, toggleAnnouncementAction } from "@/lib/actions/admin";
import { Alert, Badge, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { ActionForm, Checkbox, Field, Input, SubmitButton, Textarea } from "@/components/ui/form";
import { ActionButton, SectionTitle } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "Platform settings" };

export default async function AdminSettingsPage() {
  await requirePermissionPage("settings.manage");
  const [settings, announcements] = await Promise.all([
    getSettings(),
    db.announcement.findMany({ orderBy: { createdAt: "desc" }, take: 30 }),
  ]);

  return (
    <div>
      <PageHeader title="Platform settings" description="Every change is recorded in the audit log." />

      <Card>
        <CardBody>
          <ActionForm action={saveSettingsAction}>
            <h2 className="font-semibold text-ink">Registration fee</h2>
            <Alert>
              Current fee: <strong>{settings.registrationFeeMinor === 0 ? "Waived (0)" : formatMoney(settings.registrationFeeMinor, settings.registrationFeeCurrency)}</strong>.
              A fee of <strong>0</strong> waives the fee for new registrations. Changes apply only to registrations created after saving — existing
              payment records keep the amount they were created with.
            </Alert>
            <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
              <Field label="Registration fee (major units, e.g. birr)" name="registrationFee" hint="Enter 0 to waive the fee." required>
                <Input name="registrationFee" type="number" min={0} step="0.01" inputMode="decimal" defaultValue={settings.registrationFeeMinor / 100} required />
              </Field>
              <Field label="Currency" name="registrationFeeCurrency" required>
                <Input name="registrationFeeCurrency" maxLength={3} defaultValue={settings.registrationFeeCurrency} required />
              </Field>
            </div>
            <Field
              label="Manual payment instructions"
              name="manualPaymentInstructions"
              hint="Shown to workers on the account status page: official account numbers, accepted methods and what reference to submit."
            >
              <Textarea name="manualPaymentInstructions" rows={6} maxLength={2000} defaultValue={settings.manualPaymentInstructions} />
            </Field>

            <h2 className="pt-4 font-semibold text-ink">Employers & jobs</h2>
            <Checkbox
              name="requireCompanyApprovalToPublish"
              label="Companies must be approved before their jobs are published"
              defaultChecked={settings.requireCompanyApprovalToPublish}
            />
            <Checkbox
              name="requireJobReview"
              label="Every new job post is reviewed by staff before publishing"
              defaultChecked={settings.requireJobReview}
            />

            <h2 className="pt-4 font-semibold text-ink">Services</h2>
            <Field label="Max active service requests per customer" name="maxActiveServiceRequestsPerCustomer" required>
              <Input name="maxActiveServiceRequestsPerCustomer" type="number" min={1} max={100} defaultValue={settings.maxActiveServiceRequestsPerCustomer} className="max-w-[10rem]" required />
            </Field>

            <h2 className="pt-4 font-semibold text-ink">Support contact</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label="Support phone" name="supportPhone">
                <Input name="supportPhone" type="tel" maxLength={30} defaultValue={settings.supportPhone} />
              </Field>
              <Field label="Support email" name="supportEmail">
                <Input name="supportEmail" type="email" maxLength={120} defaultValue={settings.supportEmail} />
              </Field>
            </div>

            <div className="pt-2">
              <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
            </div>
          </ActionForm>
        </CardBody>
      </Card>

      <SectionTitle title="Announcements" description="Shown to users on the platform while active." />
      <Card>
        <CardBody>
          <ActionForm action={announcementAction} resetOnSuccess>
            <Field label="Title" name="title" required>
              <Input name="title" maxLength={120} required />
            </Field>
            <Field label="Message" name="body" required>
              <Textarea name="body" rows={3} maxLength={1000} required />
            </Field>
            <Checkbox name="notifyAll" label="Also send as a notification to all active users" />
            <SubmitButton pendingText="Publishing…">Publish announcement</SubmitButton>
          </ActionForm>
        </CardBody>
      </Card>

      {announcements.length > 0 && (
        <ul className="mt-4 space-y-3">
          {announcements.map((a) => (
            <li key={a.id}>
              <Card>
                <CardBody className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="text-sm">
                    <p className="flex flex-wrap items-center gap-2 font-semibold text-ink">
                      {a.title}
                      {a.active ? <Badge tone="success">Active</Badge> : <Badge>Inactive</Badge>}
                    </p>
                    <p className="mt-1 whitespace-pre-line text-ink">{a.body}</p>
                    <p className="mt-1 text-xs text-muted">
                      Created {formatDateTime(a.createdAt)}
                      {a.endsAt && <> · ends {formatDateTime(a.endsAt)}</>}
                    </p>
                  </div>
                  <ActionButton
                    action={toggleAnnouncementAction}
                    fields={{ id: a.id, active: a.active ? "0" : "1" }}
                    label={a.active ? "Deactivate" : "Activate"}
                    variant={a.active ? "outline" : "primary"}
                  />
                </CardBody>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
