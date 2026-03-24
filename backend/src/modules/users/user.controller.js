const service = require('./user.service');

async function getMe(req, res, next) {
  try {
    const user = await service.getProfile(req.user.id);
    return res.json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

async function patchMe(req, res, next) {
  try {
    const user = await service.updateProfile(req.user.id, req.body);
    return res.json({ success: true, user });
  } catch (err) {
    return next(err);
  }
}

async function deleteMe(req, res, next) {
  try {
    await service.deleteAccount(req.user.id);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

async function patchMyPassword(req, res, next) {
  try {
    await service.changePassword(req.user.id, req.body);
    return res.json({ success: true, message: 'Password updated' });
  } catch (err) {
    return next(err);
  }
}

async function listMyListings(req, res, next) {
  try {
    const listings = await service.myListings(req.user.id);
    return res.json({ success: true, listings });
  } catch (err) {
    return next(err);
  }
}

async function createMyListing(req, res, next) {
  try {
    const listing = await service.addListing(req.user.id, req.body);
    return res.status(201).json({ success: true, listing });
  } catch (err) {
    return next(err);
  }
}

async function deleteMyListing(req, res, next) {
  try {
    await service.removeListing(req.user.id, req.params.listingId);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

async function patchMyListingStatus(req, res, next) {
  try {
    const listing = await service.changeMyListingStatus(req.user.id, req.params.listingId, req.body.status);
    return res.json({ success: true, listing });
  } catch (err) {
    return next(err);
  }
}

async function listMyBookings(req, res, next) {
  try {
    const bookings = await service.myBookings(req.user.id);
    return res.json({ success: true, bookings });
  } catch (err) {
    return next(err);
  }
}

async function createBooking(req, res, next) {
  try {
    const booking = await service.addBooking(req.user.id, req.body);
    return res.status(201).json({ success: true, booking });
  } catch (err) {
    return next(err);
  }
}

async function deleteBooking(req, res, next) {
  try {
    await service.removeBooking(req.user.id, req.params.bookingId);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

async function listSavedSearches(req, res, next) {
  try {
    const savedSearches = await service.mySavedSearches(req.user.id);
    return res.json({ success: true, savedSearches });
  } catch (err) {
    return next(err);
  }
}

async function createSavedSearch(req, res, next) {
  try {
    const savedSearch = await service.addSavedSearch(req.user.id, req.body);
    return res.status(201).json({ success: true, savedSearch });
  } catch (err) {
    return next(err);
  }
}

async function deleteSavedSearch(req, res, next) {
  try {
    await service.removeSavedSearch(req.user.id, req.params.searchId);
    return res.json({ success: true });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  getMe,
  patchMe,
  patchMyPassword,
  deleteMe,
  listMyListings,
  createMyListing,
  deleteMyListing,
  patchMyListingStatus,
  listMyBookings,
  createBooking,
  deleteBooking,
  listSavedSearches,
  createSavedSearch,
  deleteSavedSearch,
};
