const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { requireRole } = require('../../common/middleware/role-guard');
const { ROLES } = require('../../common/constants/roles');
const { validate } = require('../../common/middleware/validate');
const { audit } = require('../../common/middleware/audit');
const { adminActionAudit } = require('../../common/middleware/admin-action-audit');
const { requireAjaxCsrf } = require('../../common/middleware/csrf');
const controller = require('./property.controller');
const { patchStatusSchema, createPropertySchema, propertyIdParamSchema, softDeletePropertySchema } = require('./property.validator');

const router = Router();

router.get('/public', controller.listPublic);
router.post('/me', requireAuth, validate(createPropertySchema), controller.createMine);
router.get('/private/:id', requireAuth, controller.getPrivateById);
router.get('/:id', controller.getById);
router.get('/', requireAuth, requireRole(ROLES.ADMIN), controller.listAll);
router.patch(
  '/:id/status',
  requireAuth,
  requireRole(ROLES.ADMIN),
  audit('property.status.update'),
  adminActionAudit('property.status.update'),
  validate(patchStatusSchema),
  controller.patchStatus
);
router.delete(
  '/:id',
  requireAuth,
  requireRole(ROLES.ADMIN),
  requireAjaxCsrf,
  audit('property.soft_delete'),
  adminActionAudit('property.soft_delete'),
  validate(propertyIdParamSchema, 'params'),
  validate(softDeletePropertySchema),
  controller.deleteForAdmin
);
router.post(
  '/:id/restore',
  requireAuth,
  requireRole(ROLES.ADMIN),
  requireAjaxCsrf,
  audit('property.restore'),
  adminActionAudit('property.restore'),
  validate(propertyIdParamSchema, 'params'),
  controller.restoreForAdmin
);

module.exports = { propertyRoutes: router };
