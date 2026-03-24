const { AppError } = require('../../common/errors/app-error');
const model = require('./user.model');
const { clearPublicPropertiesCache } = require('../properties/property.service');
const { comparePassword, hashPassword } = require('../../common/utils/password');
const { revokeAllSessionsForUser } = require('../auth/auth.service');
const cache = require('../../common/cache');

function userListingsCacheKey(userId) {
  return `listings:user:${String(userId || '').trim()}`;
}

async function getProfile(userId) {
  const user = await model.findById(userId);
  if (!user) throw new AppError(404, 'User not found');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    postalCode: user.postalCode,
    city: user.city,
    country: user.country,
    whatsappCountryCode: user.whatsappCountryCode,
    whatsappNumber: user.whatsappNumber,
    whatsappPhone: user.whatsappPhone,
  };
}

async function updateProfile(userId, payload) {
  const user = await model.updateProfile(userId, payload);
  if (!user) throw new AppError(404, 'User not found');
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    avatarUrl: user.avatarUrl,
    phone: user.phone,
    address: user.address,
    postalCode: user.postalCode,
    city: user.city,
    country: user.country,
    whatsappCountryCode: user.whatsappCountryCode,
    whatsappNumber: user.whatsappNumber,
    whatsappPhone: user.whatsappPhone,
  };
}

async function myListings(userId) {
  const cacheKey = userListingsCacheKey(userId);
  const cached = await cache.getJson(cacheKey);
  if (Array.isArray(cached)) return cached;

  const listings = await model.listMyListings(userId);
  await cache.setJson(cacheKey, listings, 45);
  return listings;
}

async function addListing(userId, payload) {
  const listing = await model.createMyListing(userId, payload);
  clearPublicPropertiesCache();
  await cache.del(userListingsCacheKey(userId));
  return listing;
}

async function myBookings(userId) {
  return model.listMyBookings(userId);
}

async function addBooking(userId, payload) {
  return model.createBooking(userId, payload);
}

async function removeBooking(userId, bookingId) {
  const ok = await model.deleteBooking(userId, bookingId);
  if (!ok) throw new AppError(404, 'Booking not found');
}

async function mySavedSearches(userId) {
  return model.listMySavedSearches(userId);
}

async function addSavedSearch(userId, payload) {
  return model.createSavedSearch(userId, payload);
}

async function removeSavedSearch(userId, searchId) {
  const ok = await model.deleteSavedSearch(userId, searchId);
  if (!ok) throw new AppError(404, 'Saved search not found');
}

async function removeListing(userId, listingId) {
  const ok = await model.deleteMyListing(userId, listingId);
  if (!ok) throw new AppError(404, 'Listing not found');
  clearPublicPropertiesCache();
  await cache.del(userListingsCacheKey(userId));
}

async function changeMyListingStatus(userId, listingId, status) {
  const listing = await model.updateMyListingStatus(userId, listingId, status);
  if (!listing) throw new AppError(404, 'Listing not found');
  clearPublicPropertiesCache();
  await cache.del(userListingsCacheKey(userId));
  return listing;
}

async function deleteAccount(userId) {
  const ok = await model.deleteAccount(userId);
  if (!ok) throw new AppError(404, 'User not found');
  clearPublicPropertiesCache();
  await cache.del(userListingsCacheKey(userId));
}

async function changePassword(userId, payload) {
  const account = await model.findAuthById(userId);
  if (!account) throw new AppError(404, 'User not found');

  const isCurrentValid = await comparePassword(payload.currentPassword, account.passwordHash);
  if (!isCurrentValid) throw new AppError(401, 'Current password is incorrect');
  if (payload.currentPassword === payload.newPassword) {
    throw new AppError(400, 'New password must be different from current password');
  }

  const newHash = await hashPassword(payload.newPassword);
  const updated = await model.updatePasswordHash(userId, newHash);
  if (!updated) throw new AppError(404, 'User not found');
  await revokeAllSessionsForUser(userId);
}

module.exports = {
  getProfile,
  updateProfile,
  myListings,
  addListing,
  myBookings,
  addBooking,
  removeBooking,
  mySavedSearches,
  addSavedSearch,
  removeSavedSearch,
  removeListing,
  changeMyListingStatus,
  deleteAccount,
  changePassword,
  userListingsCacheKey,
};
