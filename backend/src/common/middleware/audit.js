const { logSecurityEvent } = require('../utils/security-events');

function audit(action) {
  return function auditMiddleware(req, _res, next) {
    logSecurityEvent(req, {
      eventType: action,
      severity: 'info',
      metadata: {
        actorId: req.user?.id || null,
      },
    });
    next();
  };
}

module.exports = { audit };
