const { v4: uuid } = require('uuid');
const { query, withTransaction } = require('../../db/client');

function mapSlot(row) {
  if (!row) return null;
  return {
    id: row.id,
    propertyId: row.property_id,
    ownerUserId: row.owner_user_id || null,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    capacity: Number(row.capacity || 0),
    bookedCount: Number(row.booked_count || 0),
    availableCount: Math.max(0, Number(row.capacity || 0) - Number(row.booked_count || 0)),
    status: row.status,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapBooking(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    propertyId: row.property_id,
    slotId: row.slot_id || null,
    scheduledAt: row.scheduled_at,
    status: row.status,
    attendanceStatus: row.attendance_status || 'pending',
    checkedInAt: row.checked_in_at || null,
    cancelledAt: row.cancelled_at || null,
    updatedAt: row.updated_at || null,
    createdAt: row.created_at,
  };
}

function mapBookingEvent(row) {
  if (!row) return null;
  return {
    id: row.id,
    bookingId: row.booking_id,
    actorUserId: row.actor_user_id || null,
    eventType: row.event_type,
    note: row.note || '',
    metadata: row.metadata || {},
    createdAt: row.created_at,
  };
}


async function findPublicProperty(propertyId) {
  const { rows } = await query(
    `SELECT p.id, p.title, p.owner_id, p.reference_code,
            u.name AS owner_name, u.email AS owner_email
       FROM properties p
       LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1
        AND p.status = 'published'
        AND p.deleted_at IS NULL
      LIMIT 1`,
    [propertyId]
  );
  return rows[0] || null;
}

async function findPropertyOwner(propertyId) {
  const { rows } = await query(
    `SELECT p.id, p.title, p.owner_id, p.reference_code,
            u.name AS owner_name, u.email AS owner_email
       FROM properties p
       LEFT JOIN users u ON u.id = p.owner_id
      WHERE p.id = $1
      LIMIT 1`,
    [propertyId]
  );
  return rows[0] || null;
}

async function listPublicSlots(propertyId, fromAt, toAt) {
  const params = [propertyId];
  const where = ['property_id = $1', "status <> 'cancelled'", 'starts_at >= NOW()'];

  if (fromAt) {
    params.push(fromAt);
    where.push(`starts_at >= $${params.length}::timestamptz`);
  }
  if (toAt) {
    params.push(toAt);
    where.push(`starts_at <= $${params.length}::timestamptz`);
  }

  const { rows } = await query(
    `SELECT *
       FROM viewing_slots
      WHERE ${where.join(' AND ')}
      ORDER BY starts_at ASC
      LIMIT 200`,
    params
  );

  return rows.map(mapSlot);
}

async function listSlotsForManager({ actorUserId, isAdmin, propertyId }) {
  const params = [];
  const where = [];

  if (propertyId) {
    params.push(propertyId);
    where.push(`vs.property_id = $${params.length}`);
  }

  if (!isAdmin) {
    params.push(actorUserId);
    where.push(`vs.owner_user_id = $${params.length}`);
  }

  const { rows } = await query(
    `SELECT vs.*
       FROM viewing_slots vs
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY vs.starts_at ASC
      LIMIT 500`,
    params
  );

  return rows.map(mapSlot);
}

async function createSlot(payload) {
  const { rows } = await query(
    `INSERT INTO viewing_slots
      (id, property_id, owner_user_id, starts_at, ends_at, capacity, status, created_by, updated_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, 'open', $7, NOW())
     RETURNING *`,
    [
      uuid(),
      payload.propertyId,
      payload.ownerUserId || null,
      payload.startsAt,
      payload.endsAt,
      payload.capacity,
      payload.createdBy || null,
    ]
  );
  return mapSlot(rows[0]);
}

async function updateSlotStatus(slotId, status, actorUserId, isAdmin) {
  const params = [slotId, status];
  let ownerClause = '';
  if (!isAdmin) {
    params.push(actorUserId);
    ownerClause = ` AND owner_user_id = $${params.length}`;
  }

  const { rows } = await query(
    `UPDATE viewing_slots
        SET status = $2,
            updated_at = NOW()
      WHERE id = $1
        ${ownerClause}
      RETURNING *`,
    params
  );

  return mapSlot(rows[0]);
}

async function bookSlot({ userId, slotId, propertyId }) {
  return withTransaction(async (client) => {
    const slotRes = await client.query(
      `SELECT *
         FROM viewing_slots
        WHERE id = $1
        FOR UPDATE`,
      [slotId]
    );
    const slot = slotRes.rows[0];
    if (!slot) return { booking: null, slot: null, reason: 'slot-not-found' };
    if (propertyId && slot.property_id !== propertyId) return { booking: null, slot: mapSlot(slot), reason: 'slot-property-mismatch' };
    if (slot.status !== 'open') return { booking: null, slot: mapSlot(slot), reason: 'slot-closed' };
    if (new Date(slot.starts_at).getTime() <= Date.now()) return { booking: null, slot: mapSlot(slot), reason: 'slot-started' };
    if (Number(slot.booked_count) >= Number(slot.capacity)) return { booking: null, slot: mapSlot(slot), reason: 'slot-full' };

    const existingRes = await client.query(
      `SELECT id
         FROM bookings
        WHERE user_id = $1
          AND slot_id = $2
          AND status <> 'cancelled'
        LIMIT 1`,
      [userId, slotId]
    );
    if (existingRes.rows[0]) return { booking: null, slot: mapSlot(slot), reason: 'already-booked' };

    const sameDayRes = await client.query(
      `SELECT id
         FROM bookings
        WHERE user_id = $1
          AND status IN ('booked', 'rescheduled')
          AND DATE(scheduled_at AT TIME ZONE 'Europe/Stockholm') = DATE($2::timestamptz AT TIME ZONE 'Europe/Stockholm')
        LIMIT 1`,
      [userId, slot.starts_at]
    );
    if (sameDayRes.rows[0]) return { booking: null, slot: mapSlot(slot), reason: 'already-booked-same-day' };

    const bookingId = uuid();
    const insertRes = await client.query(
      `INSERT INTO bookings (id, user_id, property_id, slot_id, scheduled_at, status, attendance_status)
       VALUES ($1, $2, $3, $4, $5, 'booked', 'pending')
       RETURNING *`,
      [bookingId, userId, slot.property_id, slot.id, slot.starts_at]
    );

    await client.query(
      `INSERT INTO booking_events (id, booking_id, actor_user_id, event_type, metadata)
       VALUES ($1, $2, $3, 'created', $4::jsonb)`,
      [uuid(), bookingId, userId, JSON.stringify({ slotId: slot.id, scheduledAt: slot.starts_at })]
    );

    const afterCount = Number(slot.booked_count) + 1;
    const nextStatus = afterCount >= Number(slot.capacity) ? 'closed' : 'open';
    const updatedSlotRes = await client.query(
      `UPDATE viewing_slots
          SET booked_count = $2,
              status = $3,
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [slot.id, afterCount, nextStatus]
    );

    return {
      booking: mapBooking(insertRes.rows[0]),
      slot: mapSlot(updatedSlotRes.rows[0]),
      reason: null,
    };
  });
}

async function listMyBookingsDetailed(userId) {
  const { rows } = await query(
    `SELECT b.*,
            p.title, p.location, p.price, p.image_url, p.reference_code, p.property_type
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
      WHERE b.user_id = $1
        AND p.deleted_at IS NULL
      ORDER BY b.scheduled_at ASC`,
    [userId]
  );
  return rows.map((r) => ({
    ...mapBooking(r),
    title: r.title,
    location: r.location,
    price: Number(r.price || 0),
    imageUrl: r.image_url || null,
    referenceCode: r.reference_code || null,
    propertyType: r.property_type || null,
  }));
}

async function findBookingById(bookingId) {
  const { rows } = await query(
    `SELECT b.*, p.title, p.location, p.price, p.owner_id, p.reference_code, p.property_type, p.image_url
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
      WHERE b.id = $1
      LIMIT 1`,
    [bookingId]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    ...mapBooking(row),
    title: row.title,
    location: row.location,
    price: Number(row.price || 0),
    ownerId: row.owner_id || null,
    referenceCode: row.reference_code || null,
    propertyType: row.property_type || null,
    imageUrl: row.image_url || null,
  };
}

async function appendBookingEvent({ bookingId, actorUserId, eventType, note, metadata }) {
  const { rows } = await query(
    `INSERT INTO booking_events (id, booking_id, actor_user_id, event_type, note, metadata)
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     RETURNING *`,
    [uuid(), bookingId, actorUserId || null, eventType, note || null, JSON.stringify(metadata || {})]
  );
  return mapBookingEvent(rows[0]);
}

async function listBookingEvents(bookingId) {
  const { rows } = await query(
    `SELECT *
       FROM booking_events
      WHERE booking_id = $1
      ORDER BY created_at DESC`,
    [bookingId]
  );
  return rows.map(mapBookingEvent);
}

async function cancelBooking({ bookingId, userId, actorUserId, isAdmin }) {
  return withTransaction(async (client) => {
    const bookingRes = await client.query(
      `SELECT *
         FROM bookings
        WHERE id = $1
        FOR UPDATE`,
      [bookingId]
    );
    const booking = bookingRes.rows[0];
    if (!booking) return null;
    if (!isAdmin && String(booking.user_id) !== String(userId)) return null;
    if (booking.status === 'cancelled') return mapBooking(booking);

    const updatedBookingRes = await client.query(
      `UPDATE bookings
          SET status = 'cancelled',
              cancelled_at = NOW(),
              updated_at = NOW(),
              attendance_status = 'pending'
        WHERE id = $1
        RETURNING *`,
      [bookingId]
    );

    if (booking.slot_id) {
      const slotRes = await client.query(
        `SELECT *
           FROM viewing_slots
          WHERE id = $1
          FOR UPDATE`,
        [booking.slot_id]
      );
      const slot = slotRes.rows[0];
      if (slot) {
        const bookedCount = Math.max(0, Number(slot.booked_count || 0) - 1);
        const nextStatus = slot.status === 'cancelled'
          ? 'cancelled'
          : (bookedCount < Number(slot.capacity || 0) ? 'open' : 'closed');
        await client.query(
          `UPDATE viewing_slots
              SET booked_count = $2,
                  status = $3,
                  updated_at = NOW()
            WHERE id = $1`,
          [slot.id, bookedCount, nextStatus]
        );
      }
    }

    await client.query(
      `INSERT INTO booking_events (id, booking_id, actor_user_id, event_type)
       VALUES ($1, $2, $3, 'cancelled')`,
      [uuid(), bookingId, actorUserId || userId || null]
    );

    return mapBooking(updatedBookingRes.rows[0]);
  });
}

async function rescheduleBooking({ bookingId, userId, actorUserId, isAdmin, targetSlotId }) {
  return withTransaction(async (client) => {
    const bookingRes = await client.query(
      `SELECT *
         FROM bookings
        WHERE id = $1
        FOR UPDATE`,
      [bookingId]
    );
    const booking = bookingRes.rows[0];
    if (!booking) return { booking: null, reason: 'booking-not-found' };
    if (!isAdmin && String(booking.user_id) !== String(userId)) return { booking: null, reason: 'forbidden' };
    if (booking.status === 'cancelled') return { booking: null, reason: 'booking-cancelled' };

    const targetSlotRes = await client.query(
      `SELECT *
         FROM viewing_slots
        WHERE id = $1
        FOR UPDATE`,
      [targetSlotId]
    );
    const targetSlot = targetSlotRes.rows[0];
    if (!targetSlot) return { booking: null, reason: 'slot-not-found' };
    if (targetSlot.property_id !== booking.property_id) return { booking: null, reason: 'slot-property-mismatch' };
    if (targetSlot.status !== 'open') return { booking: null, reason: 'slot-closed' };
    if (new Date(targetSlot.starts_at).getTime() <= Date.now()) return { booking: null, reason: 'slot-started' };
    if (Number(targetSlot.booked_count || 0) >= Number(targetSlot.capacity || 0)) return { booking: null, reason: 'slot-full' };

    const sameDayRes = await client.query(
      `SELECT id
         FROM bookings
        WHERE user_id = $1
          AND id <> $2
          AND status IN ('booked', 'rescheduled')
          AND DATE(scheduled_at AT TIME ZONE 'Europe/Stockholm') = DATE($3::timestamptz AT TIME ZONE 'Europe/Stockholm')
        LIMIT 1`,
      [booking.user_id, booking.id, targetSlot.starts_at]
    );
    if (sameDayRes.rows[0]) return { booking: null, reason: 'already-booked-same-day' };

    if (booking.slot_id) {
      const prevSlotRes = await client.query(
        `SELECT *
           FROM viewing_slots
          WHERE id = $1
          FOR UPDATE`,
        [booking.slot_id]
      );
      const prevSlot = prevSlotRes.rows[0];
      if (prevSlot) {
        const nextPrevCount = Math.max(0, Number(prevSlot.booked_count || 0) - 1);
        const nextPrevStatus = prevSlot.status === 'cancelled'
          ? 'cancelled'
          : (nextPrevCount < Number(prevSlot.capacity || 0) ? 'open' : 'closed');
        await client.query(
          `UPDATE viewing_slots
              SET booked_count = $2,
                  status = $3,
                  updated_at = NOW()
            WHERE id = $1`,
          [prevSlot.id, nextPrevCount, nextPrevStatus]
        );
      }
    }

    const targetCount = Number(targetSlot.booked_count || 0) + 1;
    const targetStatus = targetCount >= Number(targetSlot.capacity || 0) ? 'closed' : 'open';
    await client.query(
      `UPDATE viewing_slots
          SET booked_count = $2,
              status = $3,
              updated_at = NOW()
        WHERE id = $1`,
      [targetSlot.id, targetCount, targetStatus]
    );

    const updatedBookingRes = await client.query(
      `UPDATE bookings
          SET slot_id = $2,
              scheduled_at = $3,
              status = 'rescheduled',
              updated_at = NOW(),
              attendance_status = 'pending',
              checked_in_at = NULL
        WHERE id = $1
        RETURNING *`,
      [booking.id, targetSlot.id, targetSlot.starts_at]
    );
    const updatedBooking = mapBooking(updatedBookingRes.rows[0]);

    await client.query(
      `INSERT INTO booking_events (id, booking_id, actor_user_id, event_type, metadata)
       VALUES ($1, $2, $3, 'rescheduled', $4::jsonb)`,
      [
        uuid(),
        booking.id,
        actorUserId || userId || null,
        JSON.stringify({
          fromSlotId: booking.slot_id || null,
          toSlotId: targetSlot.id,
          toScheduledAt: targetSlot.starts_at,
        }),
      ]
    );

    return { booking: updatedBooking, reason: null };
  });
}

async function updateBookingAttendance({ bookingId, actorUserId, status }) {
  const checkedInAt = status === 'attended' ? new Date().toISOString() : null;
  const { rows } = await query(
    `UPDATE bookings
        SET attendance_status = $2,
            checked_in_at = CASE WHEN $2 = 'attended' THEN COALESCE(checked_in_at, NOW()) ELSE NULL END,
            updated_at = NOW()
      WHERE id = $1
      RETURNING *`,
    [bookingId, status]
  );
  const booking = mapBooking(rows[0]);
  if (!booking) return null;

  await appendBookingEvent({
    bookingId,
    actorUserId: actorUserId || null,
    eventType: 'checkin',
    metadata: { attendanceStatus: status, checkedInAt },
  });

  return booking;
}

async function listAdminBookings(filters = {}) {
  const where = [];
  const params = [];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (filters.fromAt) where.push(`b.scheduled_at >= ${push(filters.fromAt)}::timestamptz`);
  if (filters.toAt) where.push(`b.scheduled_at <= ${push(filters.toAt)}::timestamptz`);
  if (filters.ownerId) where.push(`p.owner_id = ${push(filters.ownerId)}`);
  if (filters.propertyId) where.push(`b.property_id = ${push(filters.propertyId)}`);
  if (filters.status) where.push(`b.status = ${push(filters.status)}`);
  if (filters.attendanceStatus) where.push(`b.attendance_status = ${push(filters.attendanceStatus)}`);
  if (filters.city) where.push(`LOWER(p.location) LIKE ${push(`%${String(filters.city).toLowerCase()}%`)}`);

  const { rows } = await query(
    `SELECT b.*,
            p.title, p.location, p.price, p.reference_code, p.image_url, p.owner_id,
            u.name AS buyer_name, u.email AS buyer_email,
            owner.name AS owner_name, owner.email AS owner_email
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       JOIN users u ON u.id = b.user_id
       LEFT JOIN users owner ON owner.id = p.owner_id
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY b.scheduled_at DESC
      LIMIT 1000`,
    params
  );

  return rows.map((r) => ({
    ...mapBooking(r),
    property: {
      id: r.property_id,
      title: r.title,
      location: r.location,
      price: Number(r.price || 0),
      referenceCode: r.reference_code || null,
      imageUrl: r.image_url || null,
      ownerId: r.owner_id || null,
      ownerName: r.owner_name || null,
      ownerEmail: r.owner_email || null,
    },
    buyer: {
      id: r.user_id,
      name: r.buyer_name || null,
      email: r.buyer_email || null,
    },
  }));
}

async function listDueReminders({ fromAt, toAt, reminderType }) {
  const reminderColumn = reminderType === '2h' ? 'reminder_2h_sent_at' : 'reminder_24h_sent_at';
  const { rows } = await query(
    `SELECT b.*, p.title, p.reference_code, p.owner_id,
            u.name AS buyer_name, u.email AS buyer_email
       FROM bookings b
       JOIN properties p ON p.id = b.property_id
       JOIN users u ON u.id = b.user_id
      WHERE b.status IN ('booked', 'rescheduled')
        AND b.scheduled_at >= $1::timestamptz
        AND b.scheduled_at < $2::timestamptz
        AND b.${reminderColumn} IS NULL
      ORDER BY b.scheduled_at ASC
      LIMIT 300`,
    [fromAt, toAt]
  );
  return rows;
}

async function markReminderSent(bookingId, reminderType) {
  const reminderColumn = reminderType === '2h' ? 'reminder_2h_sent_at' : 'reminder_24h_sent_at';
  const { rowCount } = await query(
    `UPDATE bookings
        SET ${reminderColumn} = NOW(),
            updated_at = NOW()
      WHERE id = $1`,
    [bookingId]
  );
  return rowCount > 0;
}

module.exports = {
  findPublicProperty,
  findPropertyOwner,
  listPublicSlots,
  listSlotsForManager,
  createSlot,
  updateSlotStatus,
  bookSlot,
  listMyBookingsDetailed,
  cancelBooking,
  rescheduleBooking,
  appendBookingEvent,
  listBookingEvents,
  findBookingById,
  updateBookingAttendance,
  listAdminBookings,
  listDueReminders,
  markReminderSent,
};
