const model = require('./favorite.model');
const cache = require('../../common/cache');

function userFavoritesCacheKey(userId) {
  return `favorites:user:${String(userId || '').trim()}`;
}

async function listMyFavorites(userId) {
  const cacheKey = userFavoritesCacheKey(userId);
  const cached = await cache.getJson(cacheKey);
  if (Array.isArray(cached)) return cached;

  const favorites = await model.listByUser(userId);
  await cache.setJson(cacheKey, favorites, 60);
  return favorites;
}

async function addFavorite(userId, propertyId) {
  const out = await model.add(userId, propertyId);
  await cache.del(userFavoritesCacheKey(userId));
  return out;
}

async function removeFavorite(userId, propertyId) {
  const out = await model.remove(userId, propertyId);
  await cache.del(userFavoritesCacheKey(userId));
  return out;
}

module.exports = { listMyFavorites, addFavorite, removeFavorite, userFavoritesCacheKey };
