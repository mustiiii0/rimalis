const service = require('./favorite.service');

async function listMy(req, res, next) {
  try {
    const favorites = await service.listMyFavorites(req.user.id);
    return res.json({ success: true, favorites });
  } catch (err) {
    return next(err);
  }
}

async function add(req, res, next) {
  try {
    const favorites = await service.addFavorite(req.user.id, req.params.propertyId);
    return res.status(201).json({ success: true, favorites });
  } catch (err) {
    return next(err);
  }
}

async function remove(req, res, next) {
  try {
    const favorites = await service.removeFavorite(req.user.id, req.params.propertyId);
    return res.json({ success: true, favorites });
  } catch (err) {
    return next(err);
  }
}

module.exports = { listMy, add, remove };
