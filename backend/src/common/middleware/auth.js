const { AppError } = require('../errors/app-error');
const { verifyAccessToken } = require('../utils/token');
const { logSecurityEvent } = require('../utils/security-events');

function requireAuth(req, _res, next) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    logSecurityEvent(req, {
      eventType: 'auth.missing_token',
      severity: 'warning',
    });
    return next(new AppError(401, 'Unauthorized'));
  }

  try {
    const payload = verifyAccessToken(token);
    req.user = { id: payload.sub, role: payload.role, email: payload.email };
    return next();
  } catch (_err) {
    logSecurityEvent(req, {
      eventType: 'auth.invalid_token',
      severity: 'warning',
    });
    return next(new AppError(401, 'Invalid or expired token'));
  }
}

module.exports = { requireAuth };
