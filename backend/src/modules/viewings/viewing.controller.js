const service = require('./viewing.service');

async function listPublic(req, res, next) {
  try {
    const slots = await service.listPublicSlots(req.params.propertyId, req.query || {});
    return res.json({ success: true, slots });
  } catch (err) {
    return next(err);
  }
}

async function listMine(req, res, next) {
  try {
    const slots = await service.listManageableSlots(req.user, req.query || {});
    return res.json({ success: true, slots });
  } catch (err) {
    return next(err);
  }
}

async function createMine(req, res, next) {
  try {
    const slot = await service.createSlot(req.user, req.body);
    return res.status(201).json({ success: true, slot });
  } catch (err) {
    return next(err);
  }
}

async function patchMine(req, res, next) {
  try {
    const slot = await service.patchSlotStatus(req.user, req.params.slotId, req.body);
    return res.json({ success: true, slot });
  } catch (err) {
    return next(err);
  }
}

async function book(req, res, next) {
  try {
    const result = await service.bookPublicSlot(req.user, req.body);
    return res.status(201).json({ success: true, ...result });
  } catch (err) {
    return next(err);
  }
}

async function listMyBookings(req, res, next) {
  try {
    const bookings = await service.listMyBookings(req.user);
    return res.json({ success: true, bookings });
  } catch (err) {
    return next(err);
  }
}

async function cancelMyBooking(req, res, next) {
  try {
    const booking = await service.cancelMyBooking(req.user, req.params.bookingId);
    return res.json({ success: true, booking });
  } catch (err) {
    return next(err);
  }
}

async function rescheduleMyBooking(req, res, next) {
  try {
    const booking = await service.rescheduleMyBooking(req.user, req.params.bookingId, req.body || {});
    return res.json({ success: true, booking });
  } catch (err) {
    return next(err);
  }
}

async function listBookingHistory(req, res, next) {
  try {
    const events = await service.listBookingHistory(req.user, req.params.bookingId);
    return res.json({ success: true, events });
  } catch (err) {
    return next(err);
  }
}

async function listAdminBookings(req, res, next) {
  try {
    const bookings = await service.adminListBookings(req.user, req.query || {});
    return res.json({ success: true, bookings });
  } catch (err) {
    return next(err);
  }
}

function bookingsToCsv(bookings = []) {
  const header = ['bookingId', 'scheduledAt', 'status', 'attendanceStatus', 'buyerName', 'buyerEmail', 'propertyRef', 'propertyTitle', 'propertyLocation', 'ownerName'];
  const esc = (v) => `"${String(v ?? '').replaceAll('"', '""')}"`;
  const rows = bookings.map((b) => [
    b.id,
    b.scheduledAt,
    b.status,
    b.attendanceStatus,
    b.buyer?.name,
    b.buyer?.email,
    b.property?.referenceCode,
    b.property?.title,
    b.property?.location,
    b.property?.ownerName,
  ].map(esc).join(','));
  return [header.join(','), ...rows].join('\n');
}

async function exportAdminBookingsCsv(req, res, next) {
  try {
    const bookings = await service.adminListBookings(req.user, req.query || {});
    const csv = bookingsToCsv(bookings);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=\"viewings-bookings.csv\"');
    return res.status(200).send(csv);
  } catch (err) {
    return next(err);
  }
}

async function checkInBooking(req, res, next) {
  try {
    const booking = await service.adminCheckInBooking(req.user, req.params.bookingId, req.body || {});
    return res.json({ success: true, booking });
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  listPublic,
  listMine,
  createMine,
  patchMine,
  book,
  listMyBookings,
  cancelMyBooking,
  rescheduleMyBooking,
  listBookingHistory,
  listAdminBookings,
  exportAdminBookingsCsv,
  checkInBooking,
};
