/**
 * Centralized error handler: consistent JSON format and status codes.
 */

/**
 * Create an error object for passing to next() or throwing.
 * @param {number} statusCode
 * @param {string} message
 * @param {number} [code]
 */
export function createError(statusCode, message, code = statusCode) {
  const err = new Error(message);
  err.statusCode = statusCode;
  err.code = code;
  return err;
}

/**
 * Normalize error into { statusCode, code, message }.
 */
function normalizeError(err) {
  const statusCode = err.statusCode ?? err.status ?? 500;
  const code = err.code ?? statusCode;
  const message = err.message && typeof err.message === 'string' ? err.message : 'Internal server error';
  return { statusCode, code, message };
}

/**
 * Express error handler: log and respond with { error: true, message, code }.
 */
export function errorHandlerMiddleware(err, req, res, next) {
  const { statusCode, code, message } = normalizeError(err);
  const requestId = req.id || '-';
  console.error(`[${requestId}]`, err);
  res.status(statusCode).json({
    error: true,
    message,
    code,
  });
}
