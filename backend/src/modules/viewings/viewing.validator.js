const { z } = require('../../common/validators/common');

const slotIdParamSchema = z.object({
  slotId: z.string().uuid(),
});

const bookingIdParamSchema = z.object({
  bookingId: z.string().uuid(),
});

const propertyIdParamSchema = z.object({
  propertyId: z.string().min(1).max(160),
});

const createSlotSchema = z.object({
  propertyId: z.string().min(1).max(160),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime(),
  capacity: z.coerce.number().int().min(1).max(50).default(1),
});

const patchSlotStatusSchema = z.object({
  status: z.enum(['open', 'closed', 'cancelled']),
});

const bookSlotSchema = z.object({
  slotId: z.string().uuid(),
  propertyId: z.string().min(1).max(160).optional(),
});

const rescheduleBookingSchema = z.object({
  slotId: z.string().uuid(),
});

const checkInSchema = z.object({
  attendanceStatus: z.enum(['attended', 'no_show']),
});

const adminBookingsQuerySchema = z.object({
  fromAt: z.string().datetime().optional(),
  toAt: z.string().datetime().optional(),
  ownerId: z.string().uuid().optional(),
  propertyId: z.string().min(1).max(160).optional(),
  status: z.enum(['booked', 'rescheduled', 'cancelled']).optional(),
  attendanceStatus: z.enum(['pending', 'attended', 'no_show']).optional(),
  city: z.string().min(1).max(120).optional(),
});

module.exports = {
  slotIdParamSchema,
  bookingIdParamSchema,
  propertyIdParamSchema,
  createSlotSchema,
  patchSlotStatusSchema,
  bookSlotSchema,
  rescheduleBookingSchema,
  checkInSchema,
  adminBookingsQuerySchema,
};
