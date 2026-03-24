const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { requireRole } = require('../../common/middleware/role-guard');
const { ROLES } = require('../../common/constants/roles');
const { validate } = require('../../common/middleware/validate');
const { audit } = require('../../common/middleware/audit');
const { adminActionAudit } = require('../../common/middleware/admin-action-audit');
const controller = require('./review.controller');
const { decideSchema } = require('./review.validator');

const router = Router();

router.get('/queue', requireAuth, requireRole(ROLES.ADMIN), controller.list);
router.patch(
  '/:reviewId',
  requireAuth,
  requireRole(ROLES.ADMIN),
  audit('review.decide'),
  adminActionAudit('review.decide'),
  validate(decideSchema),
  controller.patch
);

module.exports = { reviewRoutes: router };
