const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { mediaSignLimiter } = require('../../common/middleware/rate-limit');
const controller = require('./media.controller');

const router = Router();

router.get('/sign', requireAuth, mediaSignLimiter, controller.sign);
router.get('/private/:token', controller.getPrivate);

module.exports = { mediaRoutes: router };
