import "server-only";
import { PrismaClient } from "@/lib/generated/prisma";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured. Set it to your MongoDB connection string (.env locally, Project Settings → Environment Variables on Vercel).");
  if (!/^mongodb(\+srv)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a MongoDB connection string (mongodb:// or mongodb+srv://).");
  // Atlas round trips can be slow on high-latency links; Prisma's 5s default would abort
  // multi-step transactions (e.g. registration) midway. All writes inside still commit atomically.
  return new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function client(): PrismaClient {
  if (!globalForPrisma.prisma) globalForPrisma.prisma = createClient();
  return globalForPrisma.prisma;
}

/**
 * Lazily-created Prisma client. The connection is only opened on first use, so importing this
 * module never fails — `next build` (e.g. on Vercel) succeeds even before env vars are read.
 */
export const db = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const c = client();
    const value = Reflect.get(c, prop, c);
    return typeof value === "function" ? value.bind(c) : value;
  },
});

export type Db = PrismaClient;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
