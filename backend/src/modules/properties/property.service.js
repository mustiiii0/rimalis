const { AppError } = require('../../common/errors/app-error');
const model = require('./property.model');
const notificationService = require('../notifications/notification.service');
const cache = require('../../common/cache');

const PUBLIC_PROPERTIES_CACHE_TTL_MS = Number(process.env.PUBLIC_PROPERTIES_CACHE_TTL_MS || 30000);
const PUBLIC_PROPERTIES_CACHE_TTL_SECONDS = Math.max(5, Math.floor(PUBLIC_PROPERTIES_CACHE_TTL_MS / 1000));
let publicPropertiesCache = {
  expiresAt: 0,
  data: null,
};
const PUBLIC_PROPERTIES_CACHE_KEY = 'properties:public:v1';

function clearPublicPropertiesCache() {
  publicPropertiesCache = {
    expiresAt: 0,
    data: null,
  };
  cache.del(PUBLIC_PROPERTIES_CACHE_KEY).catch(() => {});
}

async function listPublicProperties() {
  const cached = await cache.getJson(PUBLIC_PROPERTIES_CACHE_KEY);
  if (Array.isArray(cached)) {
    return cached;
  }

  const now = Date.now();
  if (publicPropertiesCache.data && publicPropertiesCache.expiresAt > now) {
    return publicPropertiesCache.data;
  }

  const properties = await model.listPublished();
  await cache.setJson(PUBLIC_PROPERTIES_CACHE_KEY, properties, PUBLIC_PROPERTIES_CACHE_TTL_SECONDS);
  publicPropertiesCache = {
    expiresAt: now + PUBLIC_PROPERTIES_CACHE_TTL_MS,
    data: properties,
  };
  return properties;
}

async function listAllProperties() {
  return model.listAll();
}

function propertyIdCandidates(id) {
  const normalizedId = String(id || '').trim();
  const candidates = [normalizedId];
  if (normalizedId.startsWith('listing-')) candidates.push(normalizedId.slice('listing-'.length));
  else candidates.push(`listing-${normalizedId}`);
  return [...new Set(candidates.filter(Boolean))];
}

async function getProperty(id) {
  for (const candidateId of propertyIdCandidates(id)) {
    const prop = await model.findPublishedById(candidateId);
    if (prop) return prop;
  }

  throw new AppError(404, 'Property not found');
}

async function setPropertyStatus(id, status) {
  const normalizedId = String(id || '').trim();
  const candidates = [normalizedId];
  if (normalizedId.startsWith('listing-')) {
    candidates.push(normalizedId.slice('listing-'.length));
  } else {
    candidates.push(`listing-${normalizedId}`);
  }

  let prop = null;
  for (const candidateId of [...new Set(candidates.filter(Boolean))]) {
    prop = await model.updateStatus(candidateId, status);
    if (prop) break;
  }

  if (!prop) throw new AppError(404, 'Property not found');
  clearPublicPropertiesCache();
  if (prop.ownerId) {
    await notificationService.notifyUserAndMaybeEmail({
      userId: prop.ownerId,
      type: 'listing.status.changed',
      title: 'Annonsstatus uppdaterad',
      body: `Status för "${prop.title}" är nu "${status}".`,
      entityType: 'property',
      entityId: prop.id,
      metadata: { propertyId: prop.id, status },
      sendEmail: true,
      emailSubject: `Annonsstatus uppdaterad: ${status}`,
    });
  }
  return prop;
}

async function createMyListing(userId, payload) {
  const property = await model.createByOwner(userId, payload);
  clearPublicPropertiesCache();
  return property;
}

async function softDeleteProperty(id, actorUserId, reason) {
  const property = await model.softDeleteById(id, actorUserId, reason);
  if (!property) throw new AppError(404, 'Property not found');
  clearPublicPropertiesCache();
  return property;
}

async function restoreProperty(id) {
  const property = await model.restoreById(id);
  if (!property) throw new AppError(404, 'Property not found');
  clearPublicPropertiesCache();
  return property;
}

module.exports = {
  listPublicProperties,
  listAllProperties,
  getProperty,
  setPropertyStatus,
  createMyListing,
  clearPublicPropertiesCache,
  softDeleteProperty,
  restoreProperty,
  propertyIdCandidates,
};
