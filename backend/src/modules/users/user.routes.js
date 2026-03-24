const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { validate } = require('../../common/middleware/validate');
const controller = require('./user.controller');
const {
  updateProfileSchema,
  createBookingSchema,
  createSavedSearchSchema,
  createListingSchema,
  patchMyListingStatusSchema,
  changePasswordSchema,
} = require('./user.validator');

const router = Router();

router.get('/me', requireAuth, controller.getMe);
router.patch('/me', requireAuth, validate(updateProfileSchema), controller.patchMe);
router.patch('/me/password', requireAuth, validate(changePasswordSchema), controller.patchMyPassword);
router.delete('/me', requireAuth, controller.deleteMe);

router.get('/me/listings', requireAuth, controller.listMyListings);
router.post('/me/listings', requireAuth, validate(createListingSchema), controller.createMyListing);
router.delete('/me/listings/:listingId', requireAuth, controller.deleteMyListing);
router.patch('/me/listings/:listingId/status', requireAuth, validate(patchMyListingStatusSchema), controller.patchMyListingStatus);
router.get('/me/bookings', requireAuth, controller.listMyBookings);
router.post('/me/bookings', requireAuth, validate(createBookingSchema), controller.createBooking);
router.delete('/me/bookings/:bookingId', requireAuth, controller.deleteBooking);

router.get('/me/saved-searches', requireAuth, controller.listSavedSearches);
router.post('/me/saved-searches', requireAuth, validate(createSavedSearchSchema), controller.createSavedSearch);
router.delete('/me/saved-searches/:searchId', requireAuth, controller.deleteSavedSearch);

module.exports = { userRoutes: router };
