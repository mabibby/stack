import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { createId } from "@paralleldrive/cuid2";
import { env } from "@/lib/env";

/**
 * Object storage. Locally this is MinIO (S3_ENDPOINT + path-style); in
 * production point the same env vars at a Railway bucket / R2 / S3.
 *
 * Pattern: the browser NEVER gets our credentials. Server hands out short-lived
 * presigned URLs — one to upload, one to download — and stores only the key.
 */
export const s3 = new S3Client({
  region: env.S3_REGION,
  endpoint: env.S3_ENDPOINT,
  forcePathStyle: env.S3_FORCE_PATH_STYLE,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

const FIVE_MINUTES = 60 * 5;

/** Build a collision-free key like `uploads/<userId>/<cuid>.<ext>` */
export const objectKey = (prefix: string, filename: string): string => {
  const ext = filename.includes(".") ? filename.split(".").pop() : undefined;
  return `${prefix.replace(/\/+$/, "")}/${createId()}${ext ? `.${ext}` : ""}`;
};

export const presignUpload = (key: string, contentType: string, expiresIn = FIVE_MINUTES) =>
  getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.S3_BUCKET, Key: key, ContentType: contentType }),
    {
      expiresIn,
    },
  );

export const presignDownload = (key: string, expiresIn = FIVE_MINUTES) =>
  getSignedUrl(s3, new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }), { expiresIn });

export const deleteObject = async (key: string): Promise<void> => {
  await s3.send(new DeleteObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
};
