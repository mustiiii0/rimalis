const { AppError } = require('../errors/app-error');
const { logError } = require('../utils/logger');
const { logSecurityEvent } = require('../utils/security-events');

function errorHandler(err, req, res, _next) {
  if (err?.type === 'entity.too.large' || err?.status === 413 || err?.statusCode === 413) {
    return res.status(413).json({
      success: false,
      message: 'Bilden är för stor. Välj en mindre bild eller komprimera den.',
      requestId: req.requestId,
    });
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 400 && err.statusCode < 500) {
      const severity = err.statusCode >= 500 ? 'critical' : 'warning';
      const eventType =
        err.statusCode === 401
          ? 'request.unauthorized'
          : err.statusCode === 403
            ? 'request.forbidden'
            : err.statusCode === 429
              ? 'request.rate_limited'
              : 'request.client_error';
      logSecurityEvent(req, {
        eventType,
        severity,
        metadata: {
          statusCode: err.statusCode,
          message: err.message,
        },
      });
    }
    return res.status(err.statusCode).json({
      success: false,
      message: err.message,
      details: err.details || null,
      requestId: req.requestId,
    });
  }

  logError('Unhandled error', {
    requestId: req.requestId,
    error: err?.message || 'unknown',
    code: err?.code || null,
    stack: err?.stack || null,
  });
  logSecurityEvent(req, {
    eventType: 'request.server_error',
    severity: 'critical',
    metadata: {
      message: err?.message || 'unknown',
      code: err?.code || null,
    },
  });
  return res.status(500).json({
    success: false,
    message: 'Internal server error',
    requestId: req.requestId,
  });
}

module.exports = { errorHandler };
