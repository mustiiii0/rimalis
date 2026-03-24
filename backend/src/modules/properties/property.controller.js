const service = require('./property.service');

async function listPublic(req, res, next) {
  try {
    const properties = await service.listPublicProperties();
    // Dynamic listing data should not be browser-cached across admin approvals.
    res.setHeader('Cache-Control', 'no-store');
    return res.json({ success: true, properties });
  } catch (err) {
    return next(err);
  }
}

async function listAll(req, res, next) {
  try {
    const properties = await service.listAllProperties();
    return res.json({ success: true, properties });
  } catch (err) {
    return next(err);
  }
}

async function getById(req, res, next) {
  try {
    const property = await service.getProperty(req.params.id);
    return res.json({ success: true, property });
  } catch (err) {
    return next(err);
  }
}

async function getPrivateById(req, res, next) {
  try {
    const property = await service.getPropertyPrivate(req.params.id, req.user);
    return res.json({ success: true, property });
  } catch (err) {
    return next(err);
  }
}

async function patchStatus(req, res, next) {
  try {
    const property = await service.setPropertyStatus(req.params.id, req.body.status);
    return res.json({ success: true, property });
  } catch (err) {
    return next(err);
  }
}

async function createMine(req, res, next) {
  try {
    const property = await service.createMyListing(req.user.id, req.body);
    return res.status(201).json({ success: true, property });
  } catch (err) {
    return next(err);
  }
}

async function deleteForAdmin(req, res, next) {
  try {
    const property = await service.softDeleteProperty(req.params.id, req.user?.id, req.body?.reason || '');
    return res.json({ success: true, property, deleted: true });
  } catch (err) {
    return next(err);
  }
}

async function restoreForAdmin(req, res, next) {
  try {
    const property = await service.restoreProperty(req.params.id);
    return res.json({ success: true, property, restored: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listPublic, listAll, getById, getPrivateById, patchStatus, createMine, deleteForAdmin, restoreForAdmin };
