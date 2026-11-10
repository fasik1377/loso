/**
 * Bootstrap (or promote) a Super Admin. There is intentionally no public route for this.
 *
 *   SUPER_ADMIN_NAME="..." SUPER_ADMIN_PHONE="09..." SUPER_ADMIN_PASSWORD="..." \
 *   SUPER_ADMIN_EMAIL="you@example.com" SUPER_ADMIN_USERNAME="admin" npm run admin:create
 *
 * Email and username are optional; with them the admin can sign in by email, phone or username.
 * If the phone, email or username already belongs to a user, that user is granted SUPER_ADMIN and
 * activated (the password is left unchanged).
 */
import "dotenv/config";
import { PrismaClient } from "../lib/generated/prisma";
import { hashPassword } from "../lib/auth/password";
import { normalizePhone } from "../lib/phone";

const db = new PrismaClient();
const USERNAME_RE = /^[a-z][a-z0-9._]{2,29}$/;

async function main() {
  const name = process.env.SUPER_ADMIN_NAME?.trim();
  const phone = normalizePhone(process.env.SUPER_ADMIN_PHONE ?? "");
  const password = process.env.SUPER_ADMIN_PASSWORD ?? "";
  const email = process.env.SUPER_ADMIN_EMAIL?.trim().toLowerCase() || null;
  const username = process.env.SUPER_ADMIN_USERNAME?.trim().toLowerCase() || null;
  if (!name || !phone) throw new Error("Set SUPER_ADMIN_NAME and a valid SUPER_ADMIN_PHONE.");
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("SUPER_ADMIN_EMAIL is not a valid email address.");
  if (username && !USERNAME_RE.test(username)) {
    throw new Error("SUPER_ADMIN_USERNAME must be 3–30 characters: a letter first, then letters, digits, '.' or '_'.");
  }

  const existing = await db.user.findFirst({
    where: { OR: [{ phone }, ...(email ? [{ email }] : []), ...(username ? [{ username }] : [])] },
  });
  if (existing) {
    await db.userRole.upsert({ where: { userId_role: { userId: existing.id, role: "SUPER_ADMIN" } }, create: { userId: existing.id, role: "SUPER_ADMIN" }, update: {} });
    await db.user.update({
      where: { id: existing.id },
      data: {
        status: "ACTIVE",
        activatedAt: existing.activatedAt ?? new Date(),
        ...(email && !existing.email ? { email } : {}),
        ...(username && !existing.username ? { username } : {}),
      },
    });
    await db.auditLog.create({ data: { action: "role.grant", entityType: "User", entityId: existing.id, metadata: { role: "SUPER_ADMIN", via: "cli" } } });
    console.log(`✓ Granted SUPER_ADMIN to existing user ${existing.email ?? existing.phone}`);
    return;
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters with letters and numbers.");
  }
  const user = await db.user.create({
    data: {
      fullName: name,
      phone,
      email,
      username,
      passwordHash: await hashPassword(password),
      status: "ACTIVE",
      activatedAt: new Date(),
      roles: { create: [{ role: "SUPER_ADMIN" }] },
      profile: { create: { phoneVisibility: "HIDDEN" } },
    },
  });
  await db.auditLog.create({ data: { action: "user.create_super_admin", entityType: "User", entityId: user.id, metadata: { via: "cli" } } });
  console.log(`✓ Created super admin ${email ?? phone}${username ? ` (username: ${username})` : ""}`);
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
