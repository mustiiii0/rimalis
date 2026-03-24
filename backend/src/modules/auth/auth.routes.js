const { Router } = require('express');
const { validate } = require('../../common/middleware/validate');
const { authLimiter, authSensitiveLimiter } = require('../../common/middleware/rate-limit');
const { requireAjaxCsrf } = require('../../common/middleware/csrf');
const controller = require('./auth.controller');
const { registerSchema, loginSchema, refreshSchema, login2faSchema } = require('./auth.validator');

const router = Router();

router.post('/register', authLimiter, validate(registerSchema), controller.register);
router.post('/login', authSensitiveLimiter, validate(loginSchema), controller.login);
router.post('/login/2fa', authSensitiveLimiter, validate(login2faSchema), controller.login2fa);
router.post('/refresh', authSensitiveLimiter, requireAjaxCsrf, validate(refreshSchema), controller.refresh);
router.post('/logout', authSensitiveLimiter, requireAjaxCsrf, validate(refreshSchema), controller.logout);

module.exports = { authRoutes: router };
