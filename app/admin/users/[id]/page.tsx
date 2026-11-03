import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { requirePermissionPage } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { hasPermission, type Permission } from "@/lib/domain/permissions";
import { STAGE_INFO, canActivate, deriveAccountStage, type AccountSnapshot } from "@/lib/domain/account";
import { fileUrl } from "@/lib/services/files";
import { formatMoney, formatRange } from "@/lib/money";
import { formatDate, formatDateTime, humanize } from "@/lib/format";
import {
  accountStatusAction,
  activateUserAction,
  issueResetLinkAction,
  staffRoleAction,
} from "@/lib/actions/admin";
import { Alert, Badge, Card, CardBody, PageHeader, Table } from "@/components/ui/primitives";
import { StatusBadge, Stars } from "@/components/ui/status";
import { ActionButton, FileLink, ReasonForm, SectionTitle } from "@/components/admin/action-forms";

export const metadata: Metadata = { title: "User details" };

const STAGE_TONE = { neutral: "neutral", warning: "warning", success: "success", danger: "danger" } as const;

export default async function AdminUserDetailPage({ params }: PageProps<"/admin/users/[id]">) {
  const viewer = await requirePermissionPage("users.view");
  const can = (p: Permission) => hasPermission(viewer.roles, p);
  const { id } = await params;

  const user = await db.user.findUnique({
    where: { id },
    include: {
      roles: true,
      activatedBy: { select: { id: true, fullName: true } },
      profile: { include: { location: true } },
      registrationPayments: {
        include: { reviewedBy: { select: { fullName: true } }, transactions: { orderBy: { createdAt: "desc" } } },
      },
      verifications: {
        orderBy: { createdAt: "desc" },
        include: {
          company: { select: { id: true, name: true } },
          reviewedBy: { select: { fullName: true } },
          documents: { include: { file: { select: { originalName: true } } } },
        },
      },
      workerProfile: {
        include: {
          services: { include: { category: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
          skills: { include: { skill: { select: { name: true } } } },
        },
      },
      employerProfile: true,
      ownedCompanies: { select: { id: true, name: true, status: true, statusReason: true, createdAt: true, _count: { select: { jobs: true } } } },
    },
  });
  if (!user) notFound();

  const roles = user.roles.map((r) => r.role);
  const payment = user.registrationPayments[0] ?? null;
  const personalVerification = user.verifications.find((v) => v.companyId === null) ?? null;
  const snapshot: AccountSnapshot = {
    status: user.status,
    roles,
    payment: payment ? { status: payment.status } : null,
    verification: personalVerification ? { status: personalVerification.status } : null,
  };
  const stage = STAGE_INFO[deriveAccountStage(snapshot)];
  const activation = canActivate(snapshot);
  const isSelf = user.id === viewer.id;
  const targetIsStaff = roles.some((r) => r === "SUPER_ADMIN" || r === "ADMIN" || r === "MODERATOR");
  const viewerIsSuper = viewer.roles.includes("SUPER_ADMIN");
  const canManageTarget = !isSelf && !roles.includes("SUPER_ADMIN") && (!targetIsStaff || viewerIsSuper);

  // Names of the staff who reviewed individual transactions (no relation on the model).
  const verifierIds = [...new Set((payment?.transactions ?? []).map((t) => t.verifiedById).filter((x): x is string => !!x))];
  const showAudit = can("audit.view");
  const [verifiers, auditEntries] = await Promise.all([
    verifierIds.length ? db.user.findMany({ where: { id: { in: verifierIds } }, select: { id: true, fullName: true } }) : Promise.resolve([]),
    showAudit
      ? db.auditLog.findMany({
          where: {
            OR: [
              { entityType: "User", entityId: user.id },
              { entityType: "RegistrationPayment", entityId: { in: user.registrationPayments.map((p) => p.id) } },
              { entityType: "VerificationSubmission", entityId: { in: user.verifications.map((v) => v.id) } },
            ],
          },
          include: { actor: { select: { fullName: true } } },
          orderBy: { createdAt: "desc" },
          take: 20,
        })
      : Promise.resolve([]),
  ]);
  const verifierName = new Map(verifiers.map((v) => [v.id, v.fullName]));
  const wp = user.workerProfile;

  return (
    <div>
      <PageHeader
        title={user.fullName}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span>{user.phone}</span>
            {user.email && <span>· {user.email}</span>}
            {user.isDemo && <Badge tone="warning">Demo</Badge>}
          </span>
        }
        actions={<Link href="/admin/users" className="text-sm text-brand hover:underline">← All users</Link>}
      />

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardBody>
            <dl className="grid gap-4 text-sm sm:grid-cols-2">
              <Item label="Account status">
                <StatusBadge status={user.status} />
                {user.statusReason && <p className="mt-1 text-xs text-muted">Reason: {user.statusReason}</p>}
              </Item>
              <Item label="Derived stage">
                <Badge tone={STAGE_TONE[stage.tone]}>{stage.label}</Badge>
              </Item>
              <Item label="Roles">
                <div className="flex flex-wrap gap-1">{roles.map((r) => <Badge key={r} tone="brand">{humanize(r)}</Badge>)}</div>
              </Item>
              <Item label="Registered">{formatDateTime(user.createdAt)}</Item>
              <Item label="Activated">
                {user.activatedAt ? (
                  <>
                    {formatDateTime(user.activatedAt)}
                    {user.activatedBy && <span className="text-muted"> by {user.activatedBy.fullName}</span>}
                  </>
                ) : "—"}
              </Item>
              <Item label="Last sign-in">{formatDateTime(user.lastLoginAt)}</Item>
              <Item label="Location">{user.profile?.location?.name ?? "—"}</Item>
              <Item label="Deletion requested">{user.deletionRequestedAt ? formatDateTime(user.deletionRequestedAt) : "No"}</Item>
            </dl>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="space-y-4">
            <h2 className="font-semibold text-ink">Actions</h2>
            {isSelf && <p className="text-sm text-muted">You cannot change your own account here.</p>}

            {!isSelf && user.status === "PENDING" && can("verifications.review") && (
              <div className="space-y-2">
                {activation.ok ? (
                  <ActionButton action={activateUserAction} fields={{ id: user.id }} label="Activate account" variant="primary" />
                ) : (
                  <p className="text-xs text-muted">Cannot activate yet: {activation.reason}</p>
                )}
                <div>
                  <ReasonForm action={accountStatusAction} fields={{ id: user.id, action: "reject" }} label="Reject registration" />
                </div>
              </div>
            )}

            {canManageTarget && can("users.manage") && (
              <div className="flex flex-wrap gap-2">
                {(user.status === "ACTIVE" || user.status === "PENDING") && (
                  <ReasonForm action={accountStatusAction} fields={{ id: user.id, action: "suspend" }} label="Suspend" />
                )}
                {user.status === "SUSPENDED" && (
                  <ActionButton action={accountStatusAction} fields={{ id: user.id, action: "reactivate" }} label="Reactivate" variant="primary" />
                )}
              </div>
            )}

            {canManageTarget && can("users.manage") && (
              <div>
                <ActionButton action={issueResetLinkAction} fields={{ id: user.id }} label="Issue password reset link" />
                <p className="mt-1 text-xs text-muted">Only share the link after confirming the person&apos;s identity.</p>
              </div>
            )}

            {!isSelf && can("roles.manage") && !roles.includes("SUPER_ADMIN") && (
              <div className="border-t border-line pt-4">
                <p className="mb-2 text-sm font-medium text-ink">Staff roles</p>
                <div className="flex flex-wrap gap-2">
                  {(["ADMIN", "MODERATOR"] as const).map((role) =>
                    roles.includes(role) ? (
                      <ActionButton key={role} action={staffRoleAction} fields={{ id: user.id, role, grant: "0" }} label={`Revoke ${humanize(role)}`} />
                    ) : (
                      <ActionButton key={role} action={staffRoleAction} fields={{ id: user.id, role, grant: "1" }} label={`Grant ${humanize(role)}`} />
                    ),
                  )}
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <SectionTitle title="Registration payment" description="Payment confirmation is a separate check from identity verification." />
      {!payment ? (
        <p className="text-sm text-muted">No registration fee applies to this account.</p>
      ) : (
        <Card>
          <CardBody className="space-y-4">
            <dl className="grid gap-4 text-sm sm:grid-cols-4">
              <Item label="Amount">{formatMoney(payment.amountMinor, payment.currency)}</Item>
              <Item label="Status"><StatusBadge status={payment.status} /></Item>
              <Item label="Receipt no.">{payment.receiptNumber ? <span className="font-mono">{payment.receiptNumber}</span> : "—"}</Item>
              <Item label="Reviewed">
                {payment.reviewedAt ? `${formatDateTime(payment.reviewedAt)}${payment.reviewedBy ? ` by ${payment.reviewedBy.fullName}` : ""}` : "—"}
              </Item>
            </dl>
            {payment.reviewNote && <Alert tone="warning" title="Review note">{payment.reviewNote}</Alert>}
            {payment.transactions.length > 0 && (
              <Table>
                <thead>
                  <tr>
                    <th>Submitted</th>
                    <th>Method</th>
                    <th>Reference</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Proof</th>
                    <th>Reviewed by</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {payment.transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="whitespace-nowrap">{formatDateTime(t.createdAt)}</td>
                      <td>{humanize(t.method ?? t.provider)}</td>
                      <td className="font-mono text-xs">{t.providerReference ?? "—"}</td>
                      <td className="whitespace-nowrap">{formatMoney(t.amountMinor, t.currency)}</td>
                      <td>
                        <StatusBadge status={t.status} />
                        {t.failureReason && <p className="mt-1 text-xs text-muted">{t.failureReason}</p>}
                      </td>
                      <td><FileLink href={fileUrl(t.proofFileId)}>View proof</FileLink></td>
                      <td>{t.verifiedById ? (verifierName.get(t.verifiedById) ?? "Staff") : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </CardBody>
        </Card>
      )}

      <SectionTitle title="Verification submissions" />
      {user.verifications.length === 0 ? (
        <p className="text-sm text-muted">No verification submissions.</p>
      ) : (
        <div className="space-y-3">
          {user.verifications.map((v) => (
            <Card key={v.id}>
              <CardBody className="space-y-2 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <StatusBadge status={v.status} />
                  <span className="font-medium text-ink">{v.company ? `Company: ${v.company.name}` : "Personal identity"}</span>
                  <span className="text-muted">· submitted {formatDateTime(v.createdAt)}</span>
                  {v.reviewedAt && <span className="text-muted">· reviewed {formatDateTime(v.reviewedAt)}{v.reviewedBy ? ` by ${v.reviewedBy.fullName}` : ""}</span>}
                </div>
                {v.applicantNote && <p className="text-muted">Applicant note: {v.applicantNote}</p>}
                {v.reviewerNote && <p className="text-muted">Reviewer note: {v.reviewerNote}</p>}
                {can("verifications.review") ? (
                  <ul className="flex flex-wrap gap-3">
                    {v.documents.map((d) => (
                      <li key={d.id}>
                        <FileLink href={fileUrl(d.fileId)}>{humanize(d.kind)} · {d.file.originalName}</FileLink>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-xs text-muted">{v.documents.length} document(s) — visible to verification reviewers.</p>
                )}
              </CardBody>
            </Card>
          ))}
        </div>
      )}

      {wp && (
        <>
          <SectionTitle title="Worker profile" actions={<Link href={`/workers/${user.id}`} className="text-sm text-brand hover:underline">Public profile →</Link>} />
          <Card>
            <CardBody className="space-y-3 text-sm">
              {wp.headline && <p className="font-medium text-ink">{wp.headline}</p>}
              <dl className="grid gap-4 sm:grid-cols-4">
                <Item label="Availability"><StatusBadge status={wp.availability} /></Item>
                <Item label="Experience">{wp.yearsExperience != null ? `${wp.yearsExperience} years` : "—"}</Item>
                <Item label="Rating">
                  {wp.ratingCount > 0 && wp.ratingAverage != null ? (
                    <span className="inline-flex items-center gap-1">
                      <Stars value={Math.round(Number(wp.ratingAverage))} /> {Number(wp.ratingAverage).toFixed(1)} ({wp.ratingCount})
                    </span>
                  ) : "No reviews"}
                </Item>
                <Item label="Completed services">{wp.completedCount}</Item>
                <Item label="Seeks jobs">{wp.seeksJobs ? "Yes" : "No"}</Item>
                <Item label="Offers services">{wp.offersServices ? "Yes" : "No"}</Item>
                <Item label="Pricing">{formatRange(wp.priceMinMinor, wp.priceMaxMinor, wp.currency) ?? humanize(wp.pricingMethod)}</Item>
              </dl>
              {wp.services.length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted">Services</p>
                  <ul className="mt-1 flex flex-wrap gap-1">
                    {wp.services.map((s) => (
                      <li key={s.id}><Badge tone={s.active ? "brand" : "neutral"}>{s.category.name}: {s.title}</Badge></li>
                    ))}
                  </ul>
                </div>
              )}
              {wp.skills.length > 0 && (
                <p className="text-xs text-muted">Skills: {wp.skills.map((s) => s.skill.name).join(", ")}</p>
              )}
            </CardBody>
          </Card>
        </>
      )}

      {(user.employerProfile || user.ownedCompanies.length > 0) && (
        <>
          <SectionTitle title="Employer" description={user.employerProfile ? `${humanize(user.employerProfile.employerType)} employer${user.employerProfile.positionTitle ? ` · ${user.employerProfile.positionTitle}` : ""}` : undefined} />
          {user.ownedCompanies.length === 0 ? (
            <p className="text-sm text-muted">No company created yet.</p>
          ) : (
            <Table>
              <thead>
                <tr><th>Company</th><th>Status</th><th>Jobs</th><th>Created</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {user.ownedCompanies.map((c) => (
                  <tr key={c.id}>
                    <td><Link href={`/companies/${c.id}`} className="font-medium text-brand hover:underline">{c.name}</Link></td>
                    <td>
                      <StatusBadge status={c.status} />
                      {c.statusReason && <p className="mt-1 text-xs text-muted">{c.statusReason}</p>}
                    </td>
                    <td>{c._count.jobs}</td>
                    <td className="whitespace-nowrap">{formatDate(c.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}

      {showAudit && (
        <>
          <SectionTitle
            title="Recent activity"
            actions={<Link href={`/admin/audit-logs?entityId=${user.id}`} className="text-sm text-brand hover:underline">Full audit log →</Link>}
          />
          {auditEntries.length === 0 ? (
            <p className="text-sm text-muted">No audit entries yet.</p>
          ) : (
            <Table>
              <thead>
                <tr><th>When</th><th>Actor</th><th>Action</th><th>Entity</th></tr>
              </thead>
              <tbody className="divide-y divide-line">
                {auditEntries.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap">{formatDateTime(a.createdAt)}</td>
                    <td>{a.actor?.fullName ?? "System"}</td>
                    <td className="font-mono text-xs">{a.action}</td>
                    <td className="text-xs text-muted">{a.entityType}</td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </>
      )}
    </div>
  );
}

function Item({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-medium text-muted">{label}</dt>
      <dd className="mt-1 text-ink">{children}</dd>
    </div>
  );
}
