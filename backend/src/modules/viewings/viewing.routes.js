const { Router } = require('express');
const { requireAuth } = require('../../common/middleware/auth');
const { requireRole } = require('../../common/middleware/role-guard');
const { ROLES } = require('../../common/constants/roles');
const { validate } = require('../../common/middleware/validate');
const controller = require('./viewing.controller');
const {
  slotIdParamSchema,
  bookingIdParamSchema,
  propertyIdParamSchema,
  createSlotSchema,
  patchSlotStatusSchema,
  bookSlotSchema,
  rescheduleBookingSchema,
  checkInSchema,
  adminBookingsQuerySchema,
} = require('./viewing.validator');

const router = Router();

router.get('/slots/public/:propertyId', validate(propertyIdParamSchema, 'params'), controller.listPublic);
router.get('/slots/me', requireAuth, controller.listMine);
router.post('/slots/me', requireAuth, validate(createSlotSchema), controller.createMine);
router.patch('/slots/me/:slotId', requireAuth, validate(slotIdParamSchema, 'params'), validate(patchSlotStatusSchema), controller.patchMine);
router.post('/book', requireAuth, validate(bookSlotSchema), controller.book);
router.get('/me/bookings', requireAuth, controller.listMyBookings);
router.post('/me/bookings/:bookingId/cancel', requireAuth, validate(bookingIdParamSchema, 'params'), controller.cancelMyBooking);
router.post('/me/bookings/:bookingId/reschedule', requireAuth, validate(bookingIdParamSchema, 'params'), validate(rescheduleBookingSchema), controller.rescheduleMyBooking);
router.get('/me/bookings/:bookingId/history', requireAuth, validate(bookingIdParamSchema, 'params'), controller.listBookingHistory);
router.get('/admin/bookings', requireAuth, requireRole(ROLES.ADMIN), validate(adminBookingsQuerySchema, 'query'), controller.listAdminBookings);
router.get('/admin/bookings/export.csv', requireAuth, requireRole(ROLES.ADMIN), validate(adminBookingsQuerySchema, 'query'), controller.exportAdminBookingsCsv);
router.post('/admin/bookings/:bookingId/check-in', requireAuth, requireRole(ROLES.ADMIN), validate(bookingIdParamSchema, 'params'), validate(checkInSchema), controller.checkInBooking);

module.exports = { viewingRoutes: router };
