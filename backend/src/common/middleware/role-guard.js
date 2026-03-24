const { AppError } = require('../errors/app-error');

function requireRole(...allowedRoles) {
  return function roleGuard(req, _res, next) {
    if (!req.user) return next(new AppError(401, 'Unauthorized'));
    if (!allowedRoles.includes(req.user.role)) {
      return next(new AppError(403, 'Forbidden'));
    }
    return next();
  };
}

module.exports = { requireRole };
