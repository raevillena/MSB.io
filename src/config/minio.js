/**
 * MinIO / S3 client and presigner. App-exclusive buckets: one bucket per appId.
 */

import { S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import config from './index.js';

const protocol = config.MINIO_USE_SSL ? 'https' : 'http';
const endpoint = `${protocol}://${config.MINIO_ENDPOINT}:${config.MINIO_PORT}`;

export const s3Client = new S3Client({
  region: 'us-east-1',
  endpoint,
  forcePathStyle: true,
  credentials: {
    accessKeyId: config.MINIO_ACCESS_KEY,
    secretAccessKey: config.MINIO_SECRET_KEY,
  },
});

/**
 * Bucket name for an app (single source of truth for app-exclusive buckets).
 * @param {number} appId
 * @returns {string}
 */
export function getBucketForApp(appId) {
  return `${config.MINIO_BUCKET_PREFIX}-app-${appId}`;
}

/**
 * Generate a presigned PUT URL for uploading one object.
 * @param {string} bucket
 * @param {string} key
 * @param {string} contentType
 * @param {number} expiresInSeconds
 * @returns {Promise<string>}
 */
export async function getPresignedPutUrl(bucket, key, contentType, expiresInSeconds = config.UPLOAD_URL_EXPIRES_IN) {
  const command = new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    ContentType: contentType,
  });
  return getSignedUrl(s3Client, command, { expiresIn: expiresInSeconds });
}

export { HeadBucketCommand, CreateBucketCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
