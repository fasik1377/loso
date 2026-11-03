import "server-only";
import type { Tx } from "@/lib/db";
import { db } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";

/**
 * Append-only audit trail for administrative and financial actions.
 * Never put passwords, tokens, message bodies or document contents in metadata.
 */
export async function audit(
  entry: { actorId: string | null; action: string; entityType: string; entityId?: string | null; metadata?: Prisma.InputJsonValue },
  tx: Tx = db,
): Promise<void> {
  await tx.auditLog.create({
    data: {
      actorId: entry.actorId,
      action: entry.action,
      entityType: entry.entityType,
      entityId: entry.entityId ?? null,
      metadata: entry.metadata,
    },
  });
}
