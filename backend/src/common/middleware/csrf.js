const crypto = require('crypto');
const { AppError } = require('../errors/app-error');
const { logSecurityEvent } = require('../utils/security-events');

const CSRF_COOKIE_NAME = 'rimalis_csrf_token';

function timingSafeTokenEquals(left, right) {
  const leftBuf = Buffer.from(String(left || ''), 'utf8');
  const rightBuf = Buffer.from(String(right || ''), 'utf8');
  if (!leftBuf.length || leftBuf.length !== rightBuf.length) return false;
  return crypto.timingSafeEqual(leftBuf, rightBuf);
}

function requireAjaxCsrf(req, _res, next) {
  const requestedWith = req.headers['x-requested-with'];
  const csrfHeader = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies?.[CSRF_COOKIE_NAME];

  if (
    requestedWith === 'XMLHttpRequest'
    && typeof csrfHeader === 'string'
    && typeof csrfCookie === 'string'
    && timingSafeTokenEquals(csrfHeader, csrfCookie)
  ) {
    return next();
  }

  logSecurityEvent(req, {
    eventType: 'csrf.blocked',
    severity: 'warning',
  });
  return next(new AppError(403, 'CSRF validation failed'));
}

module.exports = { requireAjaxCsrf, CSRF_COOKIE_NAME };
