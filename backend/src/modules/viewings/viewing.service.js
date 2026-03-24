const { AppError } = require('../../common/errors/app-error');
const model = require('./viewing.model');
const notificationService = require('../notifications/notification.service');

function normalizeIsoDate(value) {
  if (!value) return null;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function assertCanManageProperty(actor, ownerUserId) {
  if (!actor) throw new AppError(401, 'Unauthorized');
  if (actor.role === 'admin') return;
  if (actor.id && ownerUserId && String(actor.id) === String(ownerUserId)) return;
  throw new AppError(403, 'Only owner or admin can manage viewing slots');
}

async function listPublicSlots(propertyId, query) {
  const property = await model.findPublicProperty(propertyId);
  if (!property) throw new AppError(404, 'Property not found');
  const fromAt = normalizeIsoDate(query?.fromAt || null);
  const toAt = normalizeIsoDate(query?.toAt || null);
  return model.listPublicSlots(propertyId, fromAt, toAt);
}

async function listManageableSlots(actor, query) {
  return model.listSlotsForManager({
    actorUserId: actor.id,
    isAdmin: actor.role === 'admin',
    propertyId: query?.propertyId || '',
  });
}

async function createSlot(actor, payload) {
  const property = await model.findPropertyOwner(payload.propertyId);
  if (!property) throw new AppError(404, 'Property not found');

  assertCanManageProperty(actor, property.owner_id);

  const startsAt = normalizeIsoDate(payload.startsAt);
  const endsAt = normalizeIsoDate(payload.endsAt);
  if (!startsAt || !endsAt) throw new AppError(400, 'Invalid slot time');
  if (new Date(endsAt).getTime() <= new Date(startsAt).getTime()) {
    throw new AppError(400, 'Slot end must be after start');
  }
  if (new Date(startsAt).getTime() <= Date.now()) {
    throw new AppError(400, 'Slot must be in the future');
  }

  const slot = await model.createSlot({
    propertyId: payload.propertyId,
    ownerUserId: property.owner_id || null,
    startsAt,
    endsAt,
    capacity: payload.capacity,
    createdBy: actor.id,
  });

  return slot;
}

async function patchSlotStatus(actor, slotId, payload) {
  const status = payload.status;
  const slot = await model.updateSlotStatus(slotId, status, actor.id, actor.role === 'admin');
  if (!slot) throw new AppError(404, 'Slot not found');
  return slot;
}

async function bookPublicSlot(actor, payload) {
  if (!actor?.id) throw new AppError(401, 'Login required to book a viewing');

  const property = await model.findPublicProperty(payload.propertyId);
  if (!property) throw new AppError(404, 'Property not found');

  const booked = await model.bookSlot({
    userId: actor.id,
    slotId: payload.slotId,
    propertyId: payload.propertyId,
  });

  if (!booked?.booking) {
    const map = {
      'slot-not-found': 'Slot not found',
      'slot-property-mismatch': 'Slot is not valid for this property',
      'slot-closed': 'Slot is no longer available',
      'slot-started': 'Slot has already started',
      'slot-full': 'Slot is fully booked',
      'already-booked': 'You already booked this slot',
      'already-booked-same-day': 'You already have a booking on this date',
    };
    throw new AppError(400, map[booked?.reason] || 'Could not book slot');
  }

  if (property?.owner_id && property.owner_id !== actor.id) {
    await notificationService.notifyUserAndMaybeEmail({
      userId: property.owner_id,
      type: 'viewing.booking.created',
      title: 'Ny visningsbokning',
      body: `En ny bokning har gjorts för ${property.title || 'din annons'}.`,
      entityType: 'property',
      entityId: booked.booking.propertyId,
      metadata: {
        bookingId: booked.booking.id,
        slotId: booked.slot?.id || null,
        scheduledAt: booked.booking.scheduledAt,
      },
      sendEmail: true,
      emailSubject: `Ny visningsbokning: ${property.title || 'annons'}`,
    });
  }

  await notificationService.notifyUserAndMaybeEmail({
    userId: actor.id,
    type: 'viewing.booking.confirmed',
    title: 'Visning bokad',
    body: `Din visning för ${property?.title || 'annonsen'} är bokad.`,
    entityType: 'booking',
    entityId: booked.booking.id,
    metadata: {
      propertyId: booked.booking.propertyId,
      slotId: booked.booking.slotId,
      scheduledAt: booked.booking.scheduledAt,
    },
    sendEmail: true,
    emailSubject: `Bekräftelse: visning bokad`,
  });

  return booked;
}

async function listMyBookings(actor) {
  if (!actor?.id) throw new AppError(401, 'Unauthorized');
  return model.listMyBookingsDetailed(actor.id);
}

async function cancelMyBooking(actor, bookingId) {
  if (!actor?.id) throw new AppError(401, 'Unauthorized');
  const booking = await model.cancelBooking({
    bookingId,
    userId: actor.id,
    actorUserId: actor.id,
    isAdmin: actor.role === 'admin',
  });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
}

async function rescheduleMyBooking(actor, bookingId, payload) {
  if (!actor?.id) throw new AppError(401, 'Unauthorized');
  const result = await model.rescheduleBooking({
    bookingId,
    userId: actor.id,
    actorUserId: actor.id,
    isAdmin: actor.role === 'admin',
    targetSlotId: payload.slotId,
  });
  if (!result?.booking) {
    const map = {
      'booking-not-found': 'Booking not found',
      forbidden: 'Not allowed to change this booking',
      'booking-cancelled': 'Booking is already cancelled',
      'slot-not-found': 'Slot not found',
      'slot-property-mismatch': 'Slot is not valid for this property',
      'slot-closed': 'Slot is no longer available',
      'slot-started': 'Slot has already started',
      'slot-full': 'Slot is fully booked',
      'already-booked-same-day': 'You already have a booking on this date',
    };
    throw new AppError(400, map[result?.reason] || 'Could not reschedule booking');
  }
  return result.booking;
}

async function listBookingHistory(actor, bookingId) {
  if (!actor?.id) throw new AppError(401, 'Unauthorized');
  const booking = await model.findBookingById(bookingId);
  if (!booking) throw new AppError(404, 'Booking not found');
  const isOwner = String(booking.userId) === String(actor.id);
  const isAgent = booking.ownerId && String(booking.ownerId) === String(actor.id);
  const isAdmin = actor.role === 'admin';
  if (!isOwner && !isAgent && !isAdmin) throw new AppError(403, 'Not allowed');
  return model.listBookingEvents(bookingId);
}

async function adminListBookings(actor, query) {
  if (actor.role !== 'admin') throw new AppError(403, 'Admin required');
  return model.listAdminBookings(query || {});
}

async function adminCheckInBooking(actor, bookingId, payload) {
  if (actor.role !== 'admin') throw new AppError(403, 'Admin required');
  const booking = await model.updateBookingAttendance({
    bookingId,
    actorUserId: actor.id,
    status: payload.attendanceStatus,
  });
  if (!booking) throw new AppError(404, 'Booking not found');
  return booking;
}

async function processViewingReminders({ now = new Date() } = {}) {
  const ms = now.getTime();
  const ranges = [
    {
      type: '24h',
      fromAt: new Date(ms + 24 * 60 * 60 * 1000),
      toAt: new Date(ms + 24 * 60 * 60 * 1000 + 60 * 1000),
      title: 'Påminnelse: visning om 24 timmar',
    },
    {
      type: '2h',
      fromAt: new Date(ms + 2 * 60 * 60 * 1000),
      toAt: new Date(ms + 2 * 60 * 60 * 1000 + 60 * 1000),
      title: 'Påminnelse: visning om 2 timmar',
    },
  ];

  let sent = 0;
  for (const range of ranges) {
    const due = await model.listDueReminders({
      fromAt: range.fromAt.toISOString(),
      toAt: range.toAt.toISOString(),
      reminderType: range.type,
    });
    for (const row of due) {
      await notificationService.notifyUserAndMaybeEmail({
        userId: row.user_id,
        type: 'viewing.booking.reminder',
        title: range.title,
        body: `Din visning för ${row.title || 'annonsen'} är ${range.type === '24h' ? 'imorgon' : 'snart'}.`,
        entityType: 'booking',
        entityId: row.id,
        metadata: {
          bookingId: row.id,
          propertyId: row.property_id,
          scheduledAt: row.scheduled_at,
          reminderType: range.type,
        },
        sendEmail: true,
        emailSubject: range.title,
      });
      await model.markReminderSent(row.id, range.type);
      await model.appendBookingEvent({
        bookingId: row.id,
        actorUserId: null,
        eventType: `reminder_${range.type}_sent`,
        metadata: { scheduledAt: row.scheduled_at },
      });
      sent += 1;
    }
  }
  return { sent };
}

module.exports = {
  listPublicSlots,
  listManageableSlots,
  createSlot,
  patchSlotStatus,
  bookPublicSlot,
  listMyBookings,
  cancelMyBooking,
  rescheduleMyBooking,
  listBookingHistory,
  adminListBookings,
  adminCheckInBooking,
  processViewingReminders,
};
