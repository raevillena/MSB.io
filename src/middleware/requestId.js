/**
 * Attach a request ID to each request and response for tracing.
 */

import { randomUUID } from 'crypto';

const HEADER = 'x-request-id';

/**
 * Use existing X-Request-ID or generate one; set req.id and response header.
 */
export function requestIdMiddleware(req, res, next) {
  const id = req.headers[HEADER] || randomUUID();
  req.id = id;
  res.setHeader(HEADER, id);
  next();
}
