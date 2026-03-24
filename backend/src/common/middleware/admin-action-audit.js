const { logSecurityEvent } = require('../utils/security-events');

function sanitizeBody(body) {
  if (!body || typeof body !== 'object') return {};

  const allowList = [
    'status',
    'reply',
    'siteName',
    'supportEmail',
    'contactPhone',
    'role',
    'name',
    'email',
    'userId',
  ];
  const safe = {};
  for (const key of allowList) {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      safe[key] = body[key];
    }
  }
  return safe;
}

function adminActionAudit(action) {
  return function adminActionAuditMiddleware(req, res, next) {
    res.on('finish', () => {
      const isAdmin = (req.user?.role || '').toLowerCase() === 'admin';
      if (!isAdmin) return;

      const method = (req.method || '').toUpperCase();
      const isMutating = ['POST', 'PUT', 'PATCH', 'DELETE'].includes(method);
      if (!isMutating) return;

      logSecurityEvent(req, {
        eventType: 'admin.action',
        severity: 'info',
        metadata: {
          action,
          outcome: res.statusCode < 400 ? 'success' : 'failed',
          statusCode: res.statusCode,
          method,
          params: req.params || {},
          body: sanitizeBody(req.body),
        },
      });
    });

    next();
  };
}

module.exports = { adminActionAudit };
