import { describe, expect, it } from "vitest";
import { CloudinaryDriver } from "@/lib/storage/cloudinary";

type Signer = { sign(params: Record<string, string>): string };

describe("Cloudinary request signing", () => {
  it("matches Cloudinary's documented example (sorted params + secret, SHA-1)", () => {
    const driver = new CloudinaryDriver("demo", "key", "abcd") as unknown as Signer;
    // Keys deliberately out of order: the signature must sort them alphabetically.
    expect(driver.sign({ timestamp: "1315060510", public_id: "sample_image" })).toBe("b4ad47fb4e25c7bf5f92a20089f9db59bc302313");
  });
});
