import "server-only";
import { createHash } from "node:crypto";
import type { StorageDriver } from "./index";

/**
 * Cloudinary storage over its REST API (no SDK needed).
 *
 * - Every file is uploaded as a PRIVATE "raw" asset: there is no public Cloudinary URL, so
 *   identity documents and payment proofs can't be opened by guessing links. "raw" also keeps
 *   PDFs working (Cloudinary blocks PDF delivery for image assets on free plans).
 * - Reads use a short-lived signed download request; the app's /api/files/[id] route still
 *   performs the permission check before anything is fetched.
 */
export class CloudinaryDriver implements StorageDriver {
  private readonly base: string;

  constructor(
    cloudName: string,
    private readonly apiKey: string,
    private readonly apiSecret: string,
    private readonly folder = "looso",
  ) {
    this.base = `https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/raw`;
  }

  /** Cloudinary signature: SHA-1 of the alphabetically sorted params + API secret. */
  private sign(params: Record<string, string>): string {
    const toSign = Object.keys(params)
      .sort()
      .map((k) => `${k}=${params[k]}`)
      .join("&");
    return createHash("sha1").update(toSign + this.apiSecret).digest("hex");
  }

  private signed(params: Record<string, string>) {
    const withTs = { ...params, timestamp: String(Math.floor(Date.now() / 1000)) };
    return { ...withTs, api_key: this.apiKey, signature: this.sign(withTs) };
  }

  private publicId(key: string) {
    return `${this.folder}/${key}`;
  }

  private async check(res: Response, what: string) {
    if (res.ok) return;
    // Cloudinary error bodies contain no secrets; keep only the message.
    const detail = await res.json().then((j: { error?: { message?: string } }) => j.error?.message).catch(() => undefined);
    throw new Error(`Cloudinary ${what} failed (${res.status})${detail ? `: ${detail}` : ""}`);
  }

  async put(key: string, body: Buffer, contentType: string) {
    const form = new FormData();
    for (const [k, v] of Object.entries(this.signed({ public_id: this.publicId(key), type: "private", overwrite: "false" }))) form.set(k, v);
    form.set("file", new Blob([new Uint8Array(body)], { type: contentType }), key.split("/").pop());
    const res = await fetch(`${this.base}/upload`, { method: "POST", body: form });
    await this.check(res, "upload");
  }

  async get(key: string) {
    const q = new URLSearchParams(this.signed({ public_id: this.publicId(key), type: "private" }));
    const res = await fetch(`${this.base}/download?${q}`, { redirect: "follow" });
    await this.check(res, "download");
    return Buffer.from(await res.arrayBuffer());
  }

  async delete(key: string) {
    const form = new FormData();
    for (const [k, v] of Object.entries(this.signed({ public_id: this.publicId(key), type: "private", invalidate: "true" }))) form.set(k, v);
    const res = await fetch(`${this.base}/destroy`, { method: "POST", body: form });
    await this.check(res, "delete");
  }
}
