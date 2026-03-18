/**
 * File routes: upload-url (presigned), delete. Auth required for both.
 */

import { Router } from 'express';
import { authMiddleware } from '../middleware/auth.js';
import { uploadUrlRateLimiter } from '../middleware/rateLimiter.js';
import { createError } from '../middleware/errorHandler.js';
import * as fileService from '../services/fileService.js';

const router = Router();

/** GET /api/files/signed-url?objectKey=... - auth required; returns presigned GET URL for private objects */
router.get('/signed-url', authMiddleware, async (req, res, next) => {
  try {
    const { objectKey } = req.query;
    if (!objectKey) {
      return res.status(400).json({ error: true, message: 'objectKey is required', code: 400 });
    }
    const result = await fileService.getSignedUrl(req.user, objectKey);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

/** POST /api/files/upload-url - rate limited, auth required */
router.post(
  '/upload-url',
  uploadUrlRateLimiter,
  authMiddleware,
  async (req, res, next) => {
    try {
      const body = req.body;
      if (!body || typeof body !== 'object') {
        return next(createError(400, 'Invalid body', 400));
      }
      const result = await fileService.createUploadUrl(body, req.user);
      res.json(result);
    } catch (err) {
      next(err);
    }
  }
);

/** DELETE /api/files/:objectKey - auth required; objectKey is URI-encoded (slashes as %2F) */
router.delete(
  '/:objectKey',
  authMiddleware,
  async (req, res, next) => {
    try {
      let objectKey = req.params.objectKey;
      if (objectKey) {
        try {
          objectKey = decodeURIComponent(objectKey);
        } catch {
          return next(createError(400, 'Invalid object key', 400));
        }
      }
      await fileService.deleteObject(objectKey, req.user);
      res.status(204).send();
    } catch (err) {
      next(err);
    }
  }
);

export default router;
