const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { publicMessageLimiter } = require('../../common/middleware/rate-limit');
const { validate } = require('../../common/middleware/validate');
const controller = require('./message.controller');
const {
  createMessageSchema,
  createPublicMessageSchema,
  messageIdParamSchema,
  messageReplySchema,
  publicMessageReplyParamsSchema,
  publicMessageReplyQuerySchema,
  publicReplyBodySchema,
} = require('./message.validator');

const router = Router();

router.get('/me', requireAuth, controller.listMy);
router.get('/me/:messageId', requireAuth, validate(messageIdParamSchema, 'params'), controller.getMy);
router.patch('/me/:messageId/read', requireAuth, validate(messageIdParamSchema, 'params'), controller.markMyRead);
router.delete('/me/:messageId', requireAuth, validate(messageIdParamSchema, 'params'), controller.deleteMy);
router.post('/me', requireAuth, validate(createMessageSchema), controller.create);
router.post('/me/:messageId/reply', requireAuth, validate(messageIdParamSchema, 'params'), validate(messageReplySchema), controller.replyMy);

router.post('/public', publicMessageLimiter, validate(createPublicMessageSchema), controller.createPublic);
router.post(
  '/public/:messageId/reply',
  publicMessageLimiter,
  validate(publicMessageReplyParamsSchema, 'params'),
  validate(publicMessageReplyQuerySchema, 'query'),
  validate(publicReplyBodySchema),
  controller.replyPublic
);
router.get(
  '/public/:messageId/reply',
  publicMessageLimiter,
  validate(publicMessageReplyParamsSchema, 'params'),
  validate(publicMessageReplyQuerySchema, 'query'),
  controller.getPublicReply
);

module.exports = { messageRoutes: router };
