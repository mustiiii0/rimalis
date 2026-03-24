const model = require('./notification.model');
const { AppError } = require('../../common/errors/app-error');
const { query } = require('../../db/client');
const { sendTransactionalEmail } = require('../../common/utils/mailer');

async function listMyNotifications(userId, limit) {
  const notifications = await model.listByUser(userId, limit);
  const unreadCount = await model.countUnread(userId);
  return { notifications, unreadCount };
}

async function markMyNotificationRead(userId, notificationId) {
  const notification = await model.markRead(userId, notificationId);
  if (!notification) throw new AppError(404, 'Notification not found');
  const unreadCount = await model.countUnread(userId);
  return { notification, unreadCount };
}

async function markAllMyNotificationsRead(userId) {
  const updated = await model.markAllRead(userId);
  return { updated, unreadCount: 0 };
}

async function createUserNotification(payload) {
  if (!payload?.userId) return null;
  return model.createNotification(payload);
}

async function notifyUserAndMaybeEmail(payload) {
  if (!payload?.userId) return { notification: null, email: { sent: false, reason: 'missing-user' } };

  const notification = await model.createNotification(payload);

  let email = { sent: false, reason: 'disabled' };
  if (payload.sendEmail) {
    const { rows } = await query(
      'SELECT email, name FROM users WHERE id = $1 LIMIT 1',
      [payload.userId]
    );
    const user = rows[0];
    if (user?.email) {
      email = await sendTransactionalEmail({
        toEmail: user.email,
        subject: payload.emailSubject || `Rimalis Group: ${payload.title}`,
        bodyText: [
          `Hej ${user.name || ''},`,
          '',
          payload.body,
          '',
          payload.emailCta || '',
        ].filter(Boolean).join('\n'),
      });
    } else {
      email = { sent: false, reason: 'missing-recipient' };
    }
  }

  return { notification, email };
}

module.exports = {
  listMyNotifications,
  markMyNotificationRead,
  markAllMyNotificationsRead,
  createUserNotification,
  notifyUserAndMaybeEmail,
};
