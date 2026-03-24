const rateLimit = require('express-rate-limit');
const { logSecurityEvent } = require('../utils/security-events');

function buildRateLimitHandler(eventType, message) {
  return function rateLimitHandler(req, res) {
    logSecurityEvent(req, {
      eventType,
      severity: 'warning',
      metadata: {
        limit: req.rateLimit?.limit || null,
        current: req.rateLimit?.current || null,
        resetTime: req.rateLimit?.resetTime || null,
      },
    });
    return res.status(429).json({
      success: false,
      message,
      requestId: req.requestId,
    });
  };
}

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.api', 'Too many requests, try again later'),
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.auth', 'Too many auth attempts, try again later'),
});

const authSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.auth_sensitive', 'Too many sensitive auth attempts, try again later'),
});

const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.admin', 'Too many admin requests, try again later'),
});

const adminSensitiveLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.admin_sensitive', 'Too many sensitive admin actions, try again later'),
});

const uploadLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.upload', 'Too many uploads, try again later'),
});

const mediaSignLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.media_sign', 'Too many media sign requests, try again later'),
});

const publicMessageLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 25,
  standardHeaders: true,
  legacyHeaders: false,
  handler: buildRateLimitHandler('rate_limit.public_message', 'Too many public message requests, try again later'),
});


module.exports = {
  apiLimiter,
  authLimiter,
  authSensitiveLimiter,
  adminLimiter,
  adminSensitiveLimiter,
  uploadLimiter,
  mediaSignLimiter,
  publicMessageLimiter,
};
