/**
 * Errors whose message is safe to show to the user. Anything else is logged and replaced
 * with a generic message so internals/secrets never reach the client.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code: "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "RATE_LIMITED" = "BAD_REQUEST",
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const forbidden = (msg = "You do not have permission to do that.") => new AppError(msg, "FORBIDDEN");
export const notFound = (msg = "Not found.") => new AppError(msg, "NOT_FOUND");
export const conflict = (msg: string) => new AppError(msg, "CONFLICT");

export type ActionResult<T = undefined> =
  | { ok: true; message?: string; data?: T }
  | { ok: false; error: string; fieldErrors?: Record<string, string[] | undefined> };

export function toActionError(err: unknown): { ok: false; error: string } {
  if (err instanceof AppError) return { ok: false, error: err.message };
  // Unique constraint violations from Prisma.
  if (typeof err === "object" && err && "code" in err && (err as { code: string }).code === "P2002") {
    return { ok: false, error: "This record already exists." };
  }
  console.error("[action error]", err instanceof Error ? err.message : err);
  return { ok: false, error: "Something went wrong. Please try again." };
}
