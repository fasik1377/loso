import "server-only";
import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

/**
 * Storage abstraction. File bytes go to a driver; metadata goes to StoredFile.
 *  - "local": private directory on disk (development / single-server only; NOT for serverless).
 *  - "s3":    any S3-compatible object store (AWS S3, Cloudflare R2, MinIO, Wasabi...).
 * Files are never served directly from the bucket or /public; /api/files/[id] authorizes every read.
 */
export interface StorageDriver {
  put(key: string, body: Buffer, contentType: string): Promise<void>;
  get(key: string): Promise<Buffer>;
  delete(key: string): Promise<void>;
}

class LocalDriver implements StorageDriver {
  constructor(private readonly root: string) {}
  private resolve(key: string) {
    const full = path.resolve(this.root, key);
    if (!full.startsWith(path.resolve(this.root))) throw new Error("Invalid storage key");
    return full;
  }
  async put(key: string, body: Buffer) {
    const full = this.resolve(key);
    await mkdir(path.dirname(full), { recursive: true });
    await writeFile(full, body);
  }
  async get(key: string) {
    return readFile(this.resolve(key));
  }
  async delete(key: string) {
    await unlink(this.resolve(key)).catch(() => undefined);
  }
}

class S3Driver implements StorageDriver {
  private clientPromise = import("@aws-sdk/client-s3").then(
    (m) =>
      ({
        m,
        client: new m.S3Client({
          region: process.env.S3_REGION ?? "auto",
          endpoint: process.env.S3_ENDPOINT || undefined,
          forcePathStyle: process.env.S3_FORCE_PATH_STYLE === "true",
          credentials: {
            accessKeyId: process.env.S3_ACCESS_KEY_ID!,
            secretAccessKey: process.env.S3_SECRET_ACCESS_KEY!,
          },
        }),
      }) as const,
  );
  constructor(private readonly bucket: string) {}
  async put(key: string, body: Buffer, contentType: string) {
    const { m, client } = await this.clientPromise;
    await client.send(new m.PutObjectCommand({ Bucket: this.bucket, Key: key, Body: body, ContentType: contentType }));
  }
  async get(key: string) {
    const { m, client } = await this.clientPromise;
    const res = await client.send(new m.GetObjectCommand({ Bucket: this.bucket, Key: key }));
    return Buffer.from(await res.Body!.transformToByteArray());
  }
  async delete(key: string) {
    const { m, client } = await this.clientPromise;
    await client.send(new m.DeleteObjectCommand({ Bucket: this.bucket, Key: key }));
  }
}

let driver: StorageDriver | null = null;

export function storage(): StorageDriver {
  if (driver) return driver;
  const kind = process.env.STORAGE_DRIVER ?? "local";
  if (kind === "s3") {
    const bucket = process.env.S3_BUCKET;
    if (!bucket || !process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
      throw new Error("STORAGE_DRIVER=s3 but S3_BUCKET / S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY are not set");
    }
    driver = new S3Driver(bucket);
  } else {
    if (process.env.NODE_ENV === "production" && process.env.ALLOW_LOCAL_STORAGE_IN_PRODUCTION !== "true") {
      throw new Error("Local file storage is disabled in production. Configure STORAGE_DRIVER=s3.");
    }
    driver = new LocalDriver(process.env.STORAGE_LOCAL_DIR ?? path.join(process.cwd(), "storage"));
  }
  return driver;
}
