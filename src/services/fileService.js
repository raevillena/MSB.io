/**
 * File service: presigned upload URL and delete. App-exclusive buckets only.
 */

import {
  s3Client,
  getBucketForApp,
  getPresignedPutUrl,
  HeadBucketCommand,
  CreateBucketCommand,
  DeleteObjectCommand,
} from '../config/minio.js';
import config from '../config/index.js';
import { sanitizeFileName, sanitizeFolder, buildObjectKey, objectKeyBelongsToUser } from '../utils/sanitize.js';
import { createError } from '../middleware/errorHandler.js';

/**
 * Ensure bucket exists; create if AUTO_CREATE_BUCKETS and bucket missing.
 * @param {string} bucket
 */
async function ensureBucketExists(bucket) {
  try {
    await s3Client.send(new HeadBucketCommand({ Bucket: bucket }));
  } catch (err) {
    if (err.name !== 'NotFound' && err.$metadata?.httpStatusCode !== 404) {
      throw createError(503, 'Storage unavailable', 503);
    }
    if (!config.AUTO_CREATE_BUCKETS) {
      throw createError(503, 'Bucket not found; contact administrator', 503);
    }
    await s3Client.send(new CreateBucketCommand({ Bucket: bucket }));
  }
}

/**
 * Create presigned PUT URL for upload. Validates MIME, size, sanitizes name/folder.
 * @param {{ fileName: string, contentType: string, folder?: string }} body
 * @param {{ userId: string, appId: number }} user
 * @returns {{ uploadUrl: string, objectKey: string, expiresIn: number }}
 */
export async function createUploadUrl(body, user) {
  const { fileName, contentType, folder: rawFolder } = body;

  if (!fileName || typeof fileName !== 'string' || !fileName.trim()) {
    throw createError(400, 'fileName is required', 400);
  }
  if (!contentType || typeof contentType !== 'string' || !contentType.trim()) {
    throw createError(400, 'contentType is required', 400);
  }

  const allowed = config.ALLOWED_MIME_TYPES;
  const normalizedType = contentType.split(';')[0].trim().toLowerCase();
  if (!allowed.includes(normalizedType)) {
    throw createError(400, 'Content type not allowed', 400);
  }

  const sanitizedFileName = sanitizeFileName(fileName);
  const folder = sanitizeFolder(rawFolder);
  const objectKey = buildObjectKey(folder, user.userId, sanitizedFileName);

  const bucket = getBucketForApp(user.appId);
  await ensureBucketExists(bucket);

  const expiresIn = config.UPLOAD_URL_EXPIRES_IN;
  const uploadUrl = await getPresignedPutUrl(bucket, objectKey, contentType, expiresIn);

  return {
    uploadUrl,
    objectKey,
    expiresIn,
  };
}

/**
 * Delete object. Only allowed for user's app bucket and key belonging to user.
 * @param {string} objectKey - from route param (decoded)
 * @param {{ userId: string, appId: number }} user
 */
export async function deleteObject(objectKey, user) {
  if (!objectKey || typeof objectKey !== 'string') {
    throw createError(400, 'Invalid object key', 400);
  }
  if (objectKey.includes('..') || objectKey.includes('\0')) {
    throw createError(403, 'Invalid object key', 403);
  }
  if (!objectKeyBelongsToUser(objectKey, user.userId)) {
    throw createError(403, 'Access denied', 403);
  }

  const bucket = getBucketForApp(user.appId);

  try {
    await s3Client.send(new DeleteObjectCommand({ Bucket: bucket, Key: objectKey }));
  } catch (err) {
    if (err.name === 'NoSuchKey' || err.$metadata?.httpStatusCode === 404) {
      throw createError(404, 'Object not found', 404);
    }
    throw createError(503, 'Storage error', 503);
  }
}
