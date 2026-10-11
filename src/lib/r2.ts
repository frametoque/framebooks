import {
  S3Client,
  PutObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from "@aws-sdk/client-s3";

// Cache S3Client instance across invocations
let s3ClientInstance: S3Client | null = null;

export function getR2Client(): S3Client {
  if (s3ClientInstance) return s3ClientInstance;

  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const endpoint =
    process.env.R2_S3_API ||
    (accountId ? `https://${accountId}.r2.cloudflarestorage.com` : undefined);

  if (!accessKeyId || !secretAccessKey || !endpoint) {
    throw new Error(
      "Cloudflare R2 is not configured. Missing R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, or endpoint."
    );
  }

  s3ClientInstance = new S3Client({
    region: "auto",
    endpoint,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  return s3ClientInstance;
}

export function getR2BucketName(): string {
  const bucket = process.env.R2_BUCKET_NAME;
  if (!bucket) {
    throw new Error("Missing R2_BUCKET_NAME environment variable.");
  }
  return bucket;
}

export function getR2PublicUrl(): string {
  const url = process.env.R2_PUBLIC_URL;
  if (!url) {
    throw new Error("Missing R2_PUBLIC_URL environment variable.");
  }
  return url.replace(/\/$/, "");
}

export type StorageFolder =
  | "logos"
  | "receipts/income"
  | "receipts/expenses"
  | "payment-slips"
  | "subscriptions"
  | "inventory"
  | string;

export interface UploadOptions {
  file: File | Blob | Buffer | Uint8Array;
  fileName?: string;
  folder?: StorageFolder;
  contentType?: string;
  customKey?: string;
}

export interface UploadResult {
  url: string;
  key: string;
}

/**
 * Uploads a file/buffer to Cloudflare R2 under an organized folder structure.
 */
export async function uploadToR2({
  file,
  fileName,
  folder,
  contentType,
  customKey,
}: UploadOptions): Promise<UploadResult> {
  const client = getR2Client();
  const bucket = getR2BucketName();
  const publicBase = getR2PublicUrl();

  let body: Buffer | Uint8Array;
  let resolvedContentType = contentType;

  if (file instanceof File || file instanceof Blob) {
    const arrayBuffer = await file.arrayBuffer();
    body = Buffer.from(arrayBuffer);
    if (!resolvedContentType && "type" in file && file.type) {
      resolvedContentType = file.type;
    }
  } else if (Buffer.isBuffer(file) || file instanceof Uint8Array) {
    body = file;
  } else {
    throw new Error("Unsupported file type for upload");
  }

  // Construct the object key
  let key: string;
  if (customKey) {
    key = customKey.replace(/^\/+/, "");
  } else {
    const safeName = (fileName || `upload-${Date.now()}`)
      .replace(/[^a-zA-Z0-9.-]/g, "_")
      .replace(/_+/g, "_");
    const cleanFolder = (folder || "uploads").replace(/^\/+|\/+$/g, "");
    key = `${cleanFolder}/${safeName}`;
  }

  // Fallback content type if not provided
  if (!resolvedContentType) {
    const ext = key.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "png":
        resolvedContentType = "image/png";
        break;
      case "jpg":
      case "jpeg":
        resolvedContentType = "image/jpeg";
        break;
      case "webp":
        resolvedContentType = "image/webp";
        break;
      case "gif":
        resolvedContentType = "image/gif";
        break;
      case "pdf":
        resolvedContentType = "application/pdf";
        break;
      default:
        resolvedContentType = "application/octet-stream";
    }
  }

  await client.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: body,
      ContentType: resolvedContentType,
    })
  );

  return {
    url: `${publicBase}/${key}`,
    key,
  };
}

/**
 * Deletes an object from Cloudflare R2 by key or full public URL.
 */
export async function deleteFromR2(urlOrKey: string): Promise<boolean> {
  if (!urlOrKey) return false;

  try {
    const client = getR2Client();
    const bucket = getR2BucketName();
    let key = urlOrKey;

    if (urlOrKey.startsWith("http://") || urlOrKey.startsWith("https://")) {
      const publicBase = getR2PublicUrl();
      if (urlOrKey.startsWith(publicBase)) {
        key = urlOrKey.slice(publicBase.length).replace(/^\/+/, "");
      } else {
        // Extract pathname from generic URL
        try {
          const parsed = new URL(urlOrKey);
          key = parsed.pathname.replace(/^\/+/, "");
        } catch {
          // ignore
        }
      }
    }

    key = key.replace(/^\/+/, "");
    if (!key) return false;

    await client.send(
      new DeleteObjectCommand({
        Bucket: bucket,
        Key: key,
      })
    );

    return true;
  } catch (err) {
    console.warn("Failed to delete object from R2:", urlOrKey, err);
    return false;
  }
}

/**
 * Checks R2 bucket connectivity/health.
 */
export async function checkR2Health(): Promise<boolean> {
  try {
    const client = getR2Client();
    const bucket = getR2BucketName();
    await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        MaxKeys: 1,
      })
    );
    return true;
  } catch (err) {
    console.error("R2 health check failed:", err);
    return false;
  }
}
