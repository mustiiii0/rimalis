const service = require('./message.service');

async function listMy(req, res, next) {
  try {
    const messages = await service.listMyMessages(req.user.id);
    return res.json({ success: true, messages });
  } catch (err) {
    return next(err);
  }
}

async function getMy(req, res, next) {
  try {
    const message = await service.getMyMessage(req.user.id, req.params.messageId);
    return res.json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function markMyRead(req, res, next) {
  try {
    const result = await service.markMyMessageRead(req.user.id, req.params.messageId);
    return res.json({ success: true, message: result });
  } catch (err) {
    return next(err);
  }
}

async function deleteMy(req, res, next) {
  try {
    const result = await service.deleteMyMessage(req.user.id, req.params.messageId);
    return res.json({ success: true, deleted: result });
  } catch (err) {
    return next(err);
  }
}

async function create(req, res, next) {
  try {
    const message = await service.sendMessage(req.user.id, req.body);
    return res.status(201).json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function replyMy(req, res, next) {
  try {
    const message = await service.replyMyMessage(req.user.id, req.params.messageId, req.body.content);
    return res.json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function createPublic(req, res, next) {
  try {
    const message = await service.sendPublicMessage(req.body);
    return res.status(201).json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function replyPublic(req, res, next) {
  try {
    const message = await service.replyPublicMessage(req.params.messageId, req.query.token, req.body);
    return res.json({ success: true, message });
  } catch (err) {
    return next(err);
  }
}

async function getPublicReply(req, res, next) {
  try {
    const reply = await service.getPublicReply(req.params.messageId, req.query.token);
    return res.json({ success: true, reply });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listMy,
  getMy,
  markMyRead,
  deleteMy,
  create,
  replyMy,
  createPublic,
  replyPublic,
  getPublicReply,
};
