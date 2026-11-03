import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { canReadFile } from "@/lib/services/files";
import { storage } from "@/lib/storage";

/**
 * Every file read goes through here so private documents (IDs, CVs, payment proofs) are
 * authorized per request. Responses are served with nosniff and a sandboxing CSP.
 */
export async function GET(_req: Request, ctx: RouteContext<"/api/files/[id]">) {
  const { id } = await ctx.params;
  const user = await getCurrentUser();
  const file = await canReadFile(user, id);
  // 404 (not 403) so the existence of private files is not revealed.
  if (!file) return new NextResponse("Not found", { status: 404 });
  const body = await storage().get(file.storageKey);
  const isPublic = file.visibility === "PUBLIC";
  return new NextResponse(new Uint8Array(body), {
    headers: {
      "Content-Type": file.mimeType,
      "Content-Length": String(body.length),
      "Content-Disposition": `inline; filename="${file.originalName.replace(/"/g, "")}"`,
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; style-src 'unsafe-inline'; sandbox",
      "Cache-Control": isPublic ? "public, max-age=3600" : "private, no-store",
    },
  });
}
