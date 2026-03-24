const model = require('./message.model');
const { AppError } = require('../../common/errors/app-error');
const notificationService = require('../notifications/notification.service');
const { query } = require('../../db/client');
const { broadcastAdminEvent } = require('../../realtime/admin-live');

async function findUserIdForMessageParticipant(message) {
  const senderEmail = String(message?.senderEmail || '').trim().toLowerCase();
  const senderPhone = String(message?.senderPhone || '').replace(/[^\d+]/g, '').trim();
  if (!senderEmail && !senderPhone) return null;

  const clauses = [];
  const params = [];

  if (senderEmail) {
    clauses.push(`LOWER(email) = LOWER($${params.length + 1})`);
    params.push(senderEmail);
  }
  if (senderPhone) {
    clauses.push(`phone = $${params.length + 1}`);
    params.push(senderPhone);
  }

  if (!clauses.length) return null;
  const { rows } = await query(
    `SELECT id
       FROM users
      WHERE ${clauses.join(' OR ')}
      ORDER BY created_at ASC
      LIMIT 1`,
    params
  );
  return rows[0]?.id || null;
}

async function listMyMessages(userId) {
  return model.listByUser(userId);
}

async function getMyMessage(userId, messageId) {
  const message = await model.getByIdAndUser(messageId, userId);
  if (!message) throw new AppError(404, 'Message not found');
  return message;
}

async function markMyMessageRead(userId, messageId) {
  const message = await model.getByIdAndUser(messageId, userId);
  if (!message) throw new AppError(404, 'Message not found');
  return model.markRead(messageId);
}

async function deleteMyMessage(userId, messageId) {
  const deletedId = await model.deleteByIdAndUser(messageId, userId);
  if (!deletedId) throw new AppError(404, 'Message not found');
  return { id: deletedId };
}

async function sendMessage(userId, payload) {
  const message = await model.createMessage(userId, payload);
  const { rows } = await query(`SELECT id FROM users WHERE role = 'admin' ORDER BY created_at ASC LIMIT 10`);
  await Promise.all(
    rows.map((row) => notificationService.createUserNotification({
      userId: row.id,
      type: 'message.new.user',
      title: 'Nytt användarmeddelande',
      body: payload.subject || 'Du har fått ett nytt meddelande.',
      entityType: 'message',
      entityId: message.id,
      metadata: { messageId: message.id, senderUserId: userId },
    }))
  );
  broadcastAdminEvent('support.updated', { messageId: message.id, action: 'new-user-message' });
  return message;
}

async function replyMyMessage(userId, messageId, content) {
  const message = await model.replyAsOwner(userId, messageId, content);
  if (!message) throw new AppError(404, 'Message not found');

  const threadOwnerId = String(message.userId || '');
  if (threadOwnerId && threadOwnerId !== String(userId)) {
    await notificationService.createUserNotification({
      userId: threadOwnerId,
      type: 'message.reply.public',
      title: 'Nytt meddelande i chatten',
      body: message.propertyTitle || message.subject || 'Du har fått ett nytt meddelande.',
      entityType: 'message',
      entityId: message.id,
      metadata: { messageId: message.id, actorUserId: userId, propertyId: message.propertyId || null },
    });
  } else {
    const participantUserId = await findUserIdForMessageParticipant(message);
    if (participantUserId && participantUserId !== String(userId)) {
      await notificationService.createUserNotification({
        userId: participantUserId,
        type: 'message.reply.owner',
        title: 'Nytt svar i chatten',
        body: message.propertyTitle || message.subject || 'Du har fått ett nytt svar.',
        entityType: 'message',
        entityId: message.id,
        metadata: { messageId: message.id, actorUserId: userId, propertyId: message.propertyId || null },
      });
    }
  }

  broadcastAdminEvent('support.updated', { messageId: message.id, action: 'owner-reply' });
  return message;
}

async function sendPublicMessage(payload) {
  const message = await model.createPublicMessage(payload);
  if (message?.userId) {
    await notificationService.notifyUserAndMaybeEmail({
      userId: message.userId,
      type: 'message.new.public',
      title: 'Nytt meddelande i chatten',
      body: message.propertyTitle || message.subject || 'Du har fått ett nytt meddelande.',
      entityType: 'message',
      entityId: message.id,
      metadata: { messageId: message.id, propertyId: message.propertyId || payload.propertyId },
      sendEmail: true,
      emailSubject: 'Rimalis Group: nytt meddelande i chatten',
    });
  }
  broadcastAdminEvent('support.updated', { messageId: message.id, action: 'new-public-message' });
  return message;
}

async function replyPublicMessage(messageId, token, payload) {
  const message = await model.replyAsPublic(messageId, token, payload);
  if (!message) throw new AppError(404, 'Message not found');
  if (message?.userId) {
    await notificationService.notifyUserAndMaybeEmail({
      userId: message.userId,
      type: 'message.reply.public',
      title: 'Nytt meddelande i chatten',
      body: message.propertyTitle || message.subject || 'Du har fått ett nytt svar på din annons.',
      entityType: 'message',
      entityId: message.id,
      metadata: { messageId: message.id, propertyId: message.propertyId || null },
      sendEmail: true,
      emailSubject: 'Rimalis Group: nytt meddelande i chatten',
    });
  }
  broadcastAdminEvent('support.updated', { messageId: message.id, action: 'public-reply' });
  return message;
}

async function getPublicReply(messageId, token) {
  const reply = await model.getPublicReply(messageId, token);
  if (!reply) throw new AppError(404, 'Message not found');
  return reply;
}

module.exports = {
  listMyMessages,
  getMyMessage,
  markMyMessageRead,
  deleteMyMessage,
  sendMessage,
  replyMyMessage,
  sendPublicMessage,
  replyPublicMessage,
  getPublicReply,
};
