const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const controller = require('./notification.controller');
const { notificationIdParamSchema } = require('./notification.validator');

const router = Router();

router.get('/me', requireAuth, controller.listMine);
router.patch('/me/read-all', requireAuth, controller.markMineAllRead);
router.patch('/me/:notificationId/read', requireAuth, validate(notificationIdParamSchema, 'params'), controller.markMineRead);

module.exports = { notificationRoutes: router };
