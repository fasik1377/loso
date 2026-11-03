import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { type ActionResult, toActionError } from "@/lib/errors";
import { fieldErrors } from "@/lib/validation/schemas";

/** Wrap a server action body: converts thrown errors into safe ActionResults, keeps redirects working. */
export async function safeAction<T = undefined>(fn: () => Promise<ActionResult<T>>): Promise<ActionResult<T>> {
  try {
    return await fn();
  } catch (err) {
    unstable_rethrow(err);
    return toActionError(err);
  }
}

export function invalid(err: z.ZodError, message = "Please correct the highlighted fields."): ActionResult<never> {
  return { ok: false, error: message, fieldErrors: fieldErrors(err) };
}
