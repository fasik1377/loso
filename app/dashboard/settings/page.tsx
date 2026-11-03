import type { Metadata } from "next";
import { requireActivePage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { formatPhone } from "@/lib/phone";
import { formatDate } from "@/lib/format";
import { Alert, Card, CardBody, PageHeader } from "@/components/ui/primitives";
import { DeletionForm, NotificationPrefsForm, PasswordForm } from "./forms";

export const metadata: Metadata = { title: "Settings" };

const TYPES = [
  ["APPLICATION", "Job applications"],
  ["SERVICE_REQUEST", "Service requests"],
  ["MESSAGE", "New messages"],
  ["REVIEW", "Reviews"],
  ["JOB", "Job posts & moderation"],
  ["ADVERTISEMENT", "Advertisements"],
  ["ANNOUNCEMENT", "Loso announcements"],
] as const;

export default async function SettingsPage() {
  const user = await requireActivePage();
  const [prefs, full] = await Promise.all([
    db.notificationPreference.findMany({ where: { userId: user.id } }),
    db.user.findUniqueOrThrow({ where: { id: user.id }, select: { deletionRequestedAt: true, createdAt: true } }),
  ]);
  const inApp = Object.fromEntries(TYPES.map(([t]) => [t, prefs.find((p) => p.type === t)?.inApp ?? true]));

  return (
    <div className="max-w-3xl space-y-6">
      <PageHeader title="Settings" description={`Signed in as ${formatPhone(user.phone)} · member since ${formatDate(full.createdAt)}`} />
      <Card>
        <CardBody>
          <h2 className="font-semibold text-ink">Notifications</h2>
          <p className="mb-4 text-sm text-muted">
            Choose which in-app notifications you receive. Account and payment decisions are always delivered. SMS and email delivery are not configured yet.
          </p>
          <NotificationPrefsForm types={TYPES.map(([value, label]) => ({ value, label, checked: inApp[value]! }))} />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="font-semibold text-ink">Privacy</h2>
          <p className="mt-1 text-sm text-muted">Phone number visibility is set on your <a href="/dashboard/profile" className="text-brand underline">profile page</a>.</p>
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="mb-4 font-semibold text-ink">Change password</h2>
          <PasswordForm />
        </CardBody>
      </Card>
      <Card>
        <CardBody>
          <h2 className="font-semibold text-danger">Delete account</h2>
          {full.deletionRequestedAt ? (
            <Alert tone="warning">You requested deletion on {formatDate(full.deletionRequestedAt)}. Our team will process it and contact you.</Alert>
          ) : (
            <>
              <p className="mb-4 text-sm text-muted">
                We will remove your profile and personal data. Payment, audit and safety records may be kept where the law or fraud prevention requires it.
              </p>
              <DeletionForm />
            </>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
