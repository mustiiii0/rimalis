const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { requireRole } = require('../../common/middleware/role-guard');
const { validate } = require('../../common/middleware/validate');
const { requireAjaxCsrf } = require('../../common/middleware/csrf');
const { adminLimiter, adminSensitiveLimiter } = require('../../common/middleware/rate-limit');
const { noStore } = require('../../common/middleware/no-store');
const { adminActionAudit } = require('../../common/middleware/admin-action-audit');
const { ROLES } = require('../../common/constants/roles');
const { audit } = require('../../common/middleware/audit');
const controller = require('./admin.controller');
const {
  replyMessageSchema,
  updateSettingsSchema,
  messageIdParamSchema,
  macroIdParamSchema,
  userIdParamSchema,
  createUserSchema,
  updateUserSchema,
  updateSiteControlsSchema,
  siteControlVersionIdParamSchema,
  auditQuerySchema,
  mediaCleanupSchema,
  threadMetaSchema,
  threadNoteSchema,
  supportMacroSchema,
  bulkMessagesSchema,
} = require('./admin.validator');

const router = Router();
router.use(adminLimiter, noStore, requireAuth, requireRole(ROLES.ADMIN));

router.get('/dashboard', audit('admin.dashboard.get'), controller.getDashboard);
router.get('/users', audit('admin.users.list'), controller.listUsers);
router.post('/users', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.users.create'), adminActionAudit('admin.users.create'), validate(createUserSchema), controller.createUser);
router.patch('/users/:userId', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.users.patch'), adminActionAudit('admin.users.patch'), validate(userIdParamSchema, 'params'), validate(updateUserSchema), controller.patchUser);
router.delete('/users/:userId', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.users.delete'), adminActionAudit('admin.users.delete'), validate(userIdParamSchema, 'params'), controller.deleteUser);
router.post('/users/:userId/restore', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.users.restore'), adminActionAudit('admin.users.restore'), validate(userIdParamSchema, 'params'), controller.restoreUser);
router.get('/messages', audit('admin.messages.list'), controller.listMessages);
router.patch('/messages/:messageId/read', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.messages.read'), adminActionAudit('admin.messages.read'), validate(messageIdParamSchema, 'params'), controller.patchMessageRead);
router.post('/messages/:messageId/reply', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.messages.reply'), adminActionAudit('admin.messages.reply'), validate(messageIdParamSchema, 'params'), validate(replyMessageSchema), controller.replyMessage);
router.get('/support/agents', audit('admin.support.agents.list'), controller.listSupportAgents);
router.patch('/messages/:messageId/meta', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.messages.meta.patch'), adminActionAudit('admin.messages.meta.patch'), validate(messageIdParamSchema, 'params'), validate(threadMetaSchema), controller.patchMessageMeta);
router.post('/messages/:messageId/notes', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.messages.notes.create'), adminActionAudit('admin.messages.notes.create'), validate(messageIdParamSchema, 'params'), validate(threadNoteSchema), controller.createMessageNote);
router.get('/messages/:messageId/notes', audit('admin.messages.notes.list'), validate(messageIdParamSchema, 'params'), controller.listMessageNotes);
router.post('/messages/bulk', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.messages.bulk'), adminActionAudit('admin.messages.bulk'), validate(bulkMessagesSchema), controller.bulkMessages);
router.get('/support/macros', audit('admin.support.macros.list'), controller.listSupportMacros);
router.post('/support/macros', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.support.macros.create'), adminActionAudit('admin.support.macros.create'), validate(supportMacroSchema), controller.createSupportMacro);
router.delete('/support/macros/:macroId', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.support.macros.delete'), adminActionAudit('admin.support.macros.delete'), validate(macroIdParamSchema, 'params'), controller.deleteSupportMacro);
router.get('/settings', audit('admin.settings.get'), controller.getSettings);
router.patch('/settings', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.settings.patch'), adminActionAudit('admin.settings.patch'), validate(updateSettingsSchema), controller.patchSettings);

router.get('/site-controls', audit('admin.site_controls.get'), controller.getSiteControls);
router.patch('/site-controls', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.site_controls.patch'), adminActionAudit('admin.site_controls.patch'), validate(updateSiteControlsSchema), controller.patchSiteControls);
router.get('/site-controls/versions', audit('admin.site_controls.versions.get'), controller.listSiteControlVersions);
router.get('/site-controls/audit', audit('admin.site_controls.audit.get'), controller.listSiteControlAudit);
router.post('/site-controls/versions/:versionId/restore', requireAjaxCsrf, audit('admin.site_controls.versions.restore'), adminActionAudit('admin.site_controls.versions.restore'), validate(siteControlVersionIdParamSchema, 'params'), controller.restoreSiteControlVersion);
router.post('/site-controls/preview-token/rotate', requireAjaxCsrf, audit('admin.site_controls.preview.rotate'), adminActionAudit('admin.site_controls.preview.rotate'), controller.rotateSitePreviewToken);
router.get('/audit', audit('admin.audit.list'), validate(auditQuerySchema, 'query'), controller.listAuditEntries);
router.get('/audit/export.csv', audit('admin.audit.export'), validate(auditQuerySchema, 'query'), controller.exportAuditEntriesCsv);
router.get('/media-health', audit('admin.media_health.get'), controller.getMediaHealth);
router.post('/media-health/cleanup', adminSensitiveLimiter, requireAjaxCsrf, audit('admin.media_health.cleanup'), adminActionAudit('admin.media_health.cleanup'), validate(mediaCleanupSchema), controller.postMediaCleanup);

module.exports = { adminRoutes: router };
