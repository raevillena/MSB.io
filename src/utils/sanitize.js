/**
 * Sanitize file names and folder segments; prevent path traversal.
 */

const MAX_FILE_NAME_LENGTH = 255;
const MAX_FOLDER_LENGTH = 64;
/** Allow alphanumeric, dash, underscore, dot; no path separators or nulls */
const SAFE_FILE_REGEX = /[^a-zA-Z0-9._-]/g;
const SAFE_FOLDER_REGEX = /[^a-zA-Z0-9_-]/g;

/**
 * Sanitize a file name: strip path, null bytes, and dangerous chars; limit length.
 * @param {string} fileName
 * @returns {string}
 */
export function sanitizeFileName(fileName) {
  if (typeof fileName !== 'string') return '';
  // Remove path segments (only use basename)
  const base = fileName.replace(/^.*[/\\]/, '').replace(/\0/g, '');
  const sanitized = base.replace(SAFE_FILE_REGEX, '').slice(0, MAX_FILE_NAME_LENGTH);
  return sanitized || 'file';
}

/**
 * Sanitize folder: reject "..", absolute paths, empty segments; single segment only.
 * @param {string} folder
 * @returns {string} sanitized segment or empty string if invalid
 */
export function sanitizeFolder(folder) {
  if (folder === undefined || folder === null) return '';
  const s = String(folder).trim();
  if (!s) return '';
  if (s.includes('..') || s.startsWith('/') || s.startsWith('\\')) return '';
  const sanitized = s.replace(SAFE_FOLDER_REGEX, '').slice(0, MAX_FOLDER_LENGTH);
  return sanitized || '';
}

/**
 * Build object key: folder/userId/timestamp_sanitizedFileName (no traversal, no double slashes).
 * @param {string} folder - optional, already sanitized
 * @param {string} userId
 * @param {string} sanitizedFileName
 * @param {number} [timestamp]
 * @returns {string}
 */
export function buildObjectKey(folder, userId, sanitizedFileName, timestamp = Date.now()) {
  const safeUserId = String(userId).replace(/[^a-zA-Z0-9._-]/g, '').slice(0, 128) || 'unknown';
  const parts = [folder, safeUserId, `${timestamp}_${sanitizedFileName}`].filter(Boolean);
  return parts.join('/').replace(/\/+/g, '/');
}

/**
 * Validate that an object key belongs to the expected pattern and userId (for delete).
 * Key is folder/userId/timestamp_file or userId/timestamp_file (no folder).
 * @param {string} objectKey - raw from request (will be decoded by route)
 * @param {string} userId
 * @returns {boolean}
 */
export function objectKeyBelongsToUser(objectKey, userId) {
  if (!objectKey || typeof objectKey !== 'string') return false;
  if (objectKey.includes('..') || objectKey.includes('\0')) return false;
  try {
    const decoded = decodeURIComponent(objectKey).replace(/\/+/g, '/');
    const segments = decoded.split('/').filter(Boolean);
    if (segments.length === 2) return segments[0] === userId;
    if (segments.length >= 3) return segments[1] === userId;
    return false;
  } catch {
    return false;
  }
}
