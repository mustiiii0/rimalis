const { v4: uuid } = require('uuid');
const { query, withTransaction } = require('../../db/client');
const storage = require('../../common/storage');

function toReferenceCode(rawCode, id) {
  if (rawCode && /^RG8-\d{4}$/.test(String(rawCode))) return String(rawCode);
  const source = String(id || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `RG8-${String(hash % 10000).padStart(4, '0')}`;
}

function mapUser(row) {
  if (!row) return null;
  const whatsappCountryCode = row.whatsapp_country_code || null;
  const whatsappNumber = row.whatsapp_number || null;
  const whatsappPhone = whatsappCountryCode && whatsappNumber
    ? `${whatsappCountryCode}${String(whatsappNumber).replace(/[^\d]/g, '')}`
    : null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    avatarUrl: row.avatar_url || null,
    phone: row.phone || null,
    address: row.address || null,
    postalCode: row.postal_code || null,
    city: row.city || null,
    country: row.country || null,
    whatsappCountryCode,
    whatsappNumber,
    whatsappPhone,
    createdAt: row.created_at,
  };
}

async function findById(id) {
  const { rows } = await query(
    `SELECT id, name, email, role, avatar_url, phone, address, postal_code, city, country, whatsapp_country_code, whatsapp_number, created_at
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return mapUser(rows[0]);
}

async function findAuthById(id) {
  const { rows } = await query(
    `SELECT id, password_hash
     FROM users
     WHERE id = $1
       AND deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    passwordHash: row.password_hash,
  };
}

async function updatePasswordHash(id, passwordHash) {
  const { rowCount } = await query(
    `UPDATE users
     SET password_hash = $2,
         updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL`,
    [id, passwordHash]
  );
  return rowCount > 0;
}

async function updateProfile(id, payload) {
  const { rows } = await query(
    `UPDATE users
      SET name = COALESCE($2, name),
           email = COALESCE($3, email),
           avatar_url = COALESCE($4, avatar_url),
           phone = COALESCE($5, phone),
           address = COALESCE($6, address),
           postal_code = COALESCE($7, postal_code),
           city = COALESCE($8, city),
           country = COALESCE($9, country),
           whatsapp_country_code = COALESCE($10, whatsapp_country_code),
           whatsapp_number = COALESCE($11, whatsapp_number),
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, name, email, role, avatar_url, phone, address, postal_code, city, country, whatsapp_country_code, whatsapp_number, created_at`,
    [
      id,
      payload.name || null,
      payload.email || null,
      payload.avatarUrl || null,
      payload.phone || null,
      payload.address || null,
      payload.postalCode || null,
      payload.city || null,
      payload.country || null,
      payload.whatsappCountryCode || null,
      payload.whatsappNumber || null,
    ]
  );

  return mapUser(rows[0]);
}

async function listMyListings(userId) {
  const { rows } = await query(
    `SELECT id, title, location, price, status, created_at,
            reference_code, property_type, living_area, rooms, address, description,
            image_url, video_url, floor_plan_url, property_details
     FROM properties
     WHERE owner_id = $1
       AND deleted_at IS NULL
     ORDER BY created_at DESC`,
    [userId]
  );

  return rows.map((r) => ({
    ...(function () {
      const imageUrls = Array.isArray(r.property_details?.imageUrls)
        ? r.property_details.imageUrls.filter((x) => typeof x === 'string' && x.trim())
        : [];
      const primaryImage = r.image_url || imageUrls[0] || null;
      return {
        imageUrl: primaryImage,
        imageUrls,
      };
    })(),
    id: r.id,
    referenceCode: toReferenceCode(r.reference_code, r.id),
    title: r.title,
    location: r.location,
    price: Number(r.price),
    propertyType: r.property_type || null,
    livingArea: r.living_area || null,
    rooms: r.rooms || null,
    address: r.address || null,
    description: r.description || null,
    videoUrl: r.video_url || null,
    floorPlanUrl: r.floor_plan_url || null,
    listingDetails: r.property_details || {},
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function createMyListing(userId, payload) {
  return withTransaction(async (client) => {
    const propertyId = `listing-${uuid()}`;
    const reviewId = uuid();
    const ownerRes = await client.query('SELECT name FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [userId]);
    const ownerName = ownerRes.rows[0]?.name || null;
    const normalizedImageUrls = Array.isArray(payload.imageUrls)
      ? payload.imageUrls.filter((x) => typeof x === 'string' && x.trim())
      : [];
    const mergedDetails = {
      ...(payload.listingDetails || {}),
      publisherName: (payload.listingDetails && payload.listingDetails.publisherName) || ownerName || null,
      imageUrls: normalizedImageUrls,
    };

    const propertyRes = await client.query(
      `INSERT INTO properties
        (id, reference_code, title, location, price, status, owner_id, property_type, living_area, rooms, address, description, image_url, video_url, floor_plan_url, property_details)
       VALUES
        ($1, DEFAULT, $2, $3, $4, 'pending', $5, $6, $7, $8, $9, $10, $11, $12, $13, $14::jsonb)
       RETURNING id, title, location, price, status, created_at,
                 reference_code, property_type, living_area, rooms, address, description,
                 image_url, video_url, floor_plan_url, property_details`,
      [
        propertyId,
        payload.title,
        payload.location,
        payload.price,
        userId,
        payload.propertyType || null,
        payload.livingArea || null,
        payload.rooms || null,
        payload.address || null,
        payload.description || null,
        payload.imageUrl || null,
        payload.videoUrl || null,
        payload.floorPlanUrl || null,
        JSON.stringify(mergedDetails),
      ]
    );

    await client.query(
      `INSERT INTO reviews (id, property_id, status)
       VALUES ($1, $2, 'pending')`,
      [reviewId, propertyId]
    );

    const row = propertyRes.rows[0];
    const imageUrls = Array.isArray(row.property_details?.imageUrls)
      ? row.property_details.imageUrls.filter((x) => typeof x === 'string' && x.trim())
      : [];
    return {
      id: row.id,
      referenceCode: toReferenceCode(row.reference_code, row.id),
      title: row.title,
      location: row.location,
      price: Number(row.price),
      propertyType: row.property_type || null,
      livingArea: row.living_area || null,
      rooms: row.rooms || null,
      address: row.address || null,
      description: row.description || null,
      imageUrl: row.image_url || imageUrls[0] || null,
      imageUrls,
      videoUrl: row.video_url || null,
      floorPlanUrl: row.floor_plan_url || null,
      listingDetails: row.property_details || {},
      status: row.status,
      createdAt: row.created_at,
    };
  });
}

async function listMyBookings(userId) {
  const { rows } = await query(
    `SELECT b.id, b.property_id, b.scheduled_at, b.status, b.created_at,
            p.title, p.location, p.price
     FROM bookings b
     JOIN properties p ON p.id = b.property_id
     WHERE b.user_id = $1
       AND p.deleted_at IS NULL
     ORDER BY b.scheduled_at ASC`,
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    propertyId: r.property_id,
    title: r.title,
    location: r.location,
    price: Number(r.price),
    scheduledAt: r.scheduled_at,
    status: r.status,
    createdAt: r.created_at,
  }));
}

async function createBooking(userId, payload) {
  const { rows } = await query(
    `INSERT INTO bookings (id, user_id, property_id, scheduled_at, status)
     VALUES ($1, $2, $3, $4, 'booked')
     RETURNING id, property_id, scheduled_at, status, created_at`,
    [uuid(), userId, payload.propertyId, payload.scheduledAt]
  );

  const row = rows[0];
  return {
    id: row.id,
    propertyId: row.property_id,
    scheduledAt: row.scheduled_at,
    status: row.status,
    createdAt: row.created_at,
  };
}

async function deleteBooking(userId, bookingId) {
  const { rowCount } = await query(
    'DELETE FROM bookings WHERE id = $1 AND user_id = $2',
    [bookingId, userId]
  );
  return rowCount > 0;
}

async function listMySavedSearches(userId) {
  const { rows } = await query(
    'SELECT id, name, criteria, created_at FROM saved_searches WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );

  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    criteria: r.criteria || {},
    createdAt: r.created_at,
  }));
}

async function createSavedSearch(userId, payload) {
  const { rows } = await query(
    `INSERT INTO saved_searches (id, user_id, name, criteria)
     VALUES ($1, $2, $3, $4::jsonb)
     RETURNING id, name, criteria, created_at`,
    [uuid(), userId, payload.name, JSON.stringify(payload.criteria || {})]
  );

  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    criteria: row.criteria || {},
    createdAt: row.created_at,
  };
}

async function deleteSavedSearch(userId, searchId) {
  const { rowCount } = await query(
    'DELETE FROM saved_searches WHERE id = $1 AND user_id = $2',
    [searchId, userId]
  );
  return rowCount > 0;
}

async function updateMyListingStatus(userId, listingId, status) {
  const { rows } = await query(
    `UPDATE properties
       SET status = $3,
           updated_at = NOW()
     WHERE id = $1
       AND owner_id = $2
       AND deleted_at IS NULL
     RETURNING id, status`,
    [listingId, userId, status]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    status: row.status,
  };
}

async function cleanupListingFiles(urls = []) {
  await storage.deleteByUrls(urls);
}

async function deleteMyListing(userId, listingId) {
  return withTransaction(async (client) => {
    const existingRes = await client.query(
      `SELECT id, image_url, floor_plan_url, property_details
      FROM properties
      WHERE id = $1 AND owner_id = $2 AND deleted_at IS NULL
      LIMIT 1`,
      [listingId, userId]
    );

    const existing = existingRes.rows[0];
    if (!existing) return false;

    await client.query('DELETE FROM properties WHERE id = $1 AND owner_id = $2', [listingId, userId]);

    const extraImages = Array.isArray(existing.property_details?.imageUrls)
      ? existing.property_details.imageUrls
      : [];
    await cleanupListingFiles([existing.image_url, existing.floor_plan_url, ...extraImages]);
    return true;
  });
}

async function deleteAccount(userId) {
  return withTransaction(async (client) => {
    const ownedListingsRes = await client.query(
      `SELECT id, image_url, floor_plan_url, property_details
      FROM properties
      WHERE owner_id = $1
        AND deleted_at IS NULL`,
      [userId]
    );

    await client.query('DELETE FROM properties WHERE owner_id = $1', [userId]);
    const userDeleteRes = await client.query('DELETE FROM users WHERE id = $1', [userId]);

    if (userDeleteRes.rowCount === 0) {
      return false;
    }

    const fileUrls = [];
    for (const listing of ownedListingsRes.rows) {
      fileUrls.push(listing.image_url, listing.floor_plan_url);
      if (Array.isArray(listing.property_details?.imageUrls)) {
        fileUrls.push(...listing.property_details.imageUrls);
      }
    }
    await cleanupListingFiles(fileUrls);
    return true;
  });
}

module.exports = {
  findById,
  findAuthById,
  updatePasswordHash,
  updateProfile,
  listMyListings,
  createMyListing,
  listMyBookings,
  createBooking,
  deleteBooking,
  listMySavedSearches,
  createSavedSearch,
  deleteSavedSearch,
  updateMyListingStatus,
  deleteMyListing,
  deleteAccount,
};
