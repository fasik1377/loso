import "server-only";
import { PrismaClient } from "@/lib/generated/prisma";

function createClient() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not configured. Set it to your MongoDB connection string in .env.");
  if (!/^mongodb(\+srv)?:\/\//.test(url)) throw new Error("DATABASE_URL must be a MongoDB connection string (mongodb:// or mongodb+srv://).");
  // Atlas round trips can be slow on high-latency links; Prisma's 5s default would abort
  // multi-step transactions (e.g. registration) midway. All writes inside still commit atomically.
  return new PrismaClient({ transactionOptions: { maxWait: 10_000, timeout: 30_000 } });
}

// Reuse one client across hot reloads in development.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };
export const db = globalForPrisma.prisma ?? createClient();
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = db;

export type Db = typeof db;
export type Tx = Parameters<Parameters<Db["$transaction"]>[0]>[0];
