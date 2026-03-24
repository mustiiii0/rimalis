const service = require('./notification.service');

async function listMine(req, res, next) {
  try {
    const limit = Number(req.query.limit || 50);
    const data = await service.listMyNotifications(req.user.id, limit);
    return res.json({ success: true, ...data });
  } catch (err) {
    return next(err);
  }
}

async function markMineRead(req, res, next) {
  try {
    const data = await service.markMyNotificationRead(req.user.id, req.params.notificationId);
    return res.json({ success: true, ...data });
  } catch (err) {
    return next(err);
  }
}

async function markMineAllRead(req, res, next) {
  try {
    const data = await service.markAllMyNotificationsRead(req.user.id);
    return res.json({ success: true, ...data });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listMine,
  markMineRead,
  markMineAllRead,
};
