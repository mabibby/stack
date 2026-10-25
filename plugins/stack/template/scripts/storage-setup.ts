#!/usr/bin/env bun
/**
 * `bun run storage:setup` — make sure the file-storage bucket exists and lets the app's own pages
 * upload/download with presigned URLs (CORS for APP_URL only). Idempotent.
 * Locally `bun run setup` runs it against RustFS; in production run it once against the bucket:
 *   railway run --service web bun run storage:setup
 */
import { CreateBucketCommand, HeadBucketCommand, PutBucketCorsCommand } from "@aws-sdk/client-s3";
import { env } from "@/lib/env";
import { logger } from "@/lib/observability/logger";
import { s3 } from "@/lib/storage/s3";

const Bucket = env.S3_BUCKET;

try {
  await s3.send(new HeadBucketCommand({ Bucket }));
} catch {
  await s3.send(new CreateBucketCommand({ Bucket }));
  logger.info({ bucket: Bucket }, "storage.bucket.created");
}

const origin = new URL(env.APP_URL).origin;
try {
  await s3.send(
    new PutBucketCorsCommand({
      Bucket,
      CORSConfiguration: {
        CORSRules: [
          {
            AllowedOrigins: [origin],
            AllowedMethods: ["GET", "PUT", "HEAD"],
            AllowedHeaders: ["*"],
            ExposeHeaders: ["ETag"],
            MaxAgeSeconds: 3600,
          },
        ],
      },
    }),
  );
  logger.info({ bucket: Bucket, origin }, "storage.cors.set");
} catch (err) {
  // Some hosted buckets manage CORS in their dashboard instead of the S3 API.
  logger.warn({ err, bucket: Bucket, origin }, "storage.cors.unsupported");
}

process.exit(0);
