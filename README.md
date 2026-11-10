# Looso — Hawassa Jobs & Services Marketplace

**Your Skills. Your Opportunities.** Connecting people, skills, and opportunities across Hawassa.

Looso connects skilled workers and job seekers with customers and employers. Customers find trusted
local professionals and send service requests. Employers publish vacancies and manage applicants.
Workers register, pay a registration fee, get verified and then receive work.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, `cacheComponents`), React 19, TypeScript strict |
| Styling | Tailwind CSS 4 with Looso brand tokens (`app/globals.css`), Lucide icons |
| Database | MongoDB + Prisma 6 (MongoDB connector; needs a replica set such as MongoDB Atlas) |
| Auth | Custom: scrypt password hashing, DB-backed sessions (hashed tokens, httpOnly SameSite cookies) |
| Validation | Zod 4 (shared client/server), React Hook Form for complex forms |
| Files | Storage driver abstraction: private local disk (dev), Cloudinary (private assets) or any S3-compatible bucket (prod) |
| Tests | Vitest — unit tests for business rules + database integration tests for workflows |

## Project layout

```
app/(site)/        public pages, auth pages, account status
app/dashboard/     worker & customer area (profile, applications, requests, messages, reviews…)
app/employer/      employer area (company, jobs, applicants, advertising)
app/admin/         administration (verifications, payments, users, moderation, settings, audit)
app/api/           file serving (authorized), chat polling, unread counts, ad click/impression
lib/domain/        pure business rules (state machines, permissions, account stages) — unit tested
lib/services/      database-backed business logic (one module per area)
lib/actions/       server actions: auth + validation + rate limit, then call services
lib/auth/          password hashing, sessions, guards (requireActivePage / assertPermission …)
lib/payments/      payment provider abstraction (manual review provider only)
lib/storage/       storage drivers
prisma/            schema, migrations, seed
scripts/           create-admin bootstrap
tests/             unit + integration tests
```

## Local development

Requirements: Node.js 20.9+ (22 recommended) and a MongoDB database **running as a replica set**
(Prisma uses transactions, which MongoDB only supports on replica sets).

```bash
npm install                   # also runs `prisma generate`
cp .env.example .env          # then set DATABASE_URL to your MongoDB connection string
npm run db:push               # create collections + indexes/unique constraints from the schema
npm run db:seed               # reference data: categories, skills, Hawassa locations
npm run dev
```

Easiest database: a free **MongoDB Atlas** cluster (Database → Connect → Drivers → copy the
`mongodb+srv://…` string, add the database name `/loso`, and allow your IP under Network Access).
A local `mongod` works too if started as a single-node replica set (`mongod --replSet rs0`, then
`rs.initiate()` once in `mongosh`) with `?replicaSet=rs0` in the URL.

MongoDB has no migrations: whenever `prisma/schema.prisma` changes, run `npm run db:push` again.

### Demo data (development only)

```bash
SEED_DEMO_DATA=true SEED_DEMO_PASSWORD='ChooseAPassw0rd' npm run db:seed
```

This creates **clearly labelled demo accounts** (`isDemo`, shown with a "Demo" badge, never shown as
verified, no fabricated reviews). They are all signed in with `SEED_DEMO_PASSWORD`:

| Phone | Role |
| --- | --- |
| 0900000001 | Super admin |
| 0900000002 | Moderator |
| 0900000010 | Customer |
| 0900000020 / 21 / 22 | Workers (electrician, plumber, cleaner) |
| 0900000030 | Employer with a demo company and two demo jobs |

The demo seed also sets a **development** registration fee (ETB 200) and payment instructions that
clearly say they are not real.

### Creating the first real Super Admin

There is no public admin registration route. On the server:

```bash
SUPER_ADMIN_NAME="Full Name" SUPER_ADMIN_PHONE="09…" SUPER_ADMIN_PASSWORD="a-long-unique-passphrase-123" npm run admin:create
```

Then sign in, open **Admin → Platform settings**, and set the real registration fee and the official
payment instructions before accepting registrations. Super admins can grant ADMIN / MODERATOR roles
from the user detail page.

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Next.js |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Vitest (integration tests run when `DATABASE_URL` is set; use a dev/test database) |
| `npm run db:push` | `prisma db push` — sync collections and indexes to MongoDB |
| `npm run db:seed` | Seed reference (and optionally demo) data |
| `npm run admin:create` | Bootstrap a super admin |

## Key workflows and rules

**Worker registration** — account status, registration payment and identity verification are three
separate records (`User.status`, `RegistrationPayment`, `VerificationSubmission`). The user-facing
stage (Pending Payment → Payment Under Review → Pending Verification → Awaiting Activation → Active,
or Rejected / Suspended) is *derived* from them in `lib/domain/account.ts`.
Activation requires a verified (or waived) payment **and** approved documents; it records who
activated the account and when. Pending, rejected and suspended users can sign in, but they can
only reach `/account-status`. Every protected page and action checks the account status on the server.

**Payments** — the fee amount comes from admin settings and is copied onto the user's payment record
when they register. Users pay through an official channel published by the operator and submit the
transaction reference (plus optional proof). Staff confirm it against the real statement. A
reference can be claimed only once (unique index on `(provider, providerReference)`). Reviews use
conditional updates, so a payment cannot be processed twice. Verified payments get a receipt
number. No card data is ever handled. **Nothing is marked as paid automatically.**

**Customers** register for free and are active immediately. **Employers** are active so they can
build their company profile, but the company must be verified before jobs can be published (this
is configurable).

**Service requests**: Requested → Accepted → In Progress → Completed, plus Declined and Cancelled
(`lib/domain/service-request.ts`). Only the worker can accept or start. Only the customer can
confirm completion. The worker can only report the work as finished.

**Reviews** — only the customer of a *completed* request, one per request (enforced by a unique DB
constraint), rating 1–5 (validated on the server). Averages are recomputed on the server from
visible reviews. Moderators can hide reviews (audited), which recomputes the average.
Employers and candidates cannot review each other: v1 has no public employer/candidate feedback,
to avoid retaliation. Disputes go through reports.

**Messaging** — persisted 1:1 conversations, optionally linked to a service request or application.
Participant checks apply to every read and write. New messages arrive by **polling every 4 seconds**;
there is no realtime provider. Moderators can see and hide only messages that were reported.

**Contact & calls** — phone numbers are never public. Each user picks Hidden / Connections only /
Any signed-in user. Calls are plain `tel:` links shown only when allowed. In-app chat is always
available. There is no browser calling.

**Advertising** — promotional ads are plain text plus an uploaded raster image (no HTML/SVG). Every
ad is moderated. Scheduled/Active/Expired are derived from dates. Clicks pass through
`/api/ads/:id/click`, which only redirects to sanitized http(s) URLs. Impressions and clicks are
tracked. Advertising payments are separate from registration fees and are handled offline for now.

## Security notes

- Server-side authorization everywhere (`lib/auth/guards.ts`, `lib/domain/permissions.ts`). Roles:
  SUPER_ADMIN, ADMIN, MODERATOR (least-privilege), WORKER, CUSTOMER, EMPLOYER. Users cannot assign
  roles to themselves or change their own status. SUPER_ADMIN cannot be granted through the UI.
- Passwords: scrypt with per-password salt. Sessions: random 256-bit tokens; only the SHA-256 hash is stored.
  Login lockout after repeated failures. Reset tokens are single-use and expire after 1 hour, and a
  reset revokes all sessions.
- Rate limits (MongoDB-backed, atomic `findAndModify`) on registration, login, password reset, payments, messages,
  applications, service requests, reports and uploads.
- CSRF: Server Actions get Next.js's built-in Origin check. SameSite=Lax cookies. Mutating route
  handlers check the origin.
- Uploads: the type is checked from magic bytes (JPEG/PNG/WebP/PDF only), with per-purpose size limits.
  Files are stored outside `public/` and served through an authorized route with `nosniff` and a
  sandbox CSP. Private documents (IDs, payment proofs, CVs) are visible only to the owner and to
  authorized staff or parties.
- Audit log for administrative and financial actions. Passwords, tokens, message bodies and
  documents are never logged.
- Security headers (CSP frame-ancestors, nosniff, referrer policy, permissions policy) in `next.config.ts`.

## Deployment

1. Provision MongoDB (Atlas or another replica set) and file storage. Set `DATABASE_URL` and `APP_URL`, then either
   `STORAGE_DRIVER=cloudinary` with `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
   (recommended on Vercel; files are stored as private Cloudinary assets) or `STORAGE_DRIVER=s3` with the `S3_*`
   variables. Local disk storage is refused in production. In MongoDB Atlas, allow network access from `0.0.0.0/0`
   for serverless hosts such as Vercel. After changing environment variables on Vercel, redeploy.
2. `npm ci && npm run db:push && npm run build && npm start` (or deploy to any Node host).
   `prisma generate` runs automatically on `postinstall`.
3. `npm run db:seed` once for reference data. Do **not** set `SEED_DEMO_DATA` in production.
4. Create the super admin with `npm run admin:create`, then configure the fee and payment
   instructions in Admin → Platform settings.
5. Put the app behind HTTPS. Sessions use `Secure` cookies in production.

## Not yet integrated (configuration points)

| Capability | Status | Where to add it |
| --- | --- | --- |
| Online payments (Chapa, Telebirr) | Not implemented — needs a merchant account and credentials | `lib/payments/providers.ts` (implement `PaymentProvider`, verify via server-side callback + verify API, use `PaymentTransaction.idempotencyKey` as tx_ref) |
| SMS / email notifications | Not implemented — in-app only | `lib/notifications.ts` (`NotificationChannel`) |
| Password reset delivery | Links are created but not delivered automatically. In development the link is printed to the server log. Staff can issue a link from Admin → Users. | `lib/actions/auth.ts` |
| Realtime chat | Polling only | `app/dashboard/messages/[id]/chat-window.tsx` |
| Maps | Not used; location search uses the admin-managed location list | — |
| Amharic / Sidamu Afo | Market settings are centralized in `lib/config.ts`; UI strings are still English | — |
# looso
