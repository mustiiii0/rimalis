const { v4: uuid } = require('uuid');
const { query } = require('../../db/client');

function toReferenceCode(rawCode, id) {
  if (rawCode && /^RG8-\d{4}$/.test(String(rawCode))) return String(rawCode);
  const source = String(id || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `RG8-${String(hash % 10000).padStart(4, '0')}`;
}

function mapProperty(row) {
  if (!row) return null;
  const imageUrls = Array.isArray(row.property_details?.imageUrls)
    ? row.property_details.imageUrls.filter((x) => typeof x === 'string' && x.trim())
    : [];
  const primaryImage = row.image_url || imageUrls[0] || null;
  const ownerWhatsappCountryCode = row.owner_whatsapp_country_code || null;
  const ownerWhatsappNumber = row.owner_whatsapp_number || null;
  const ownerWhatsappPhone = ownerWhatsappCountryCode && ownerWhatsappNumber
    ? `${ownerWhatsappCountryCode}${String(ownerWhatsappNumber).replace(/[^\d]/g, '')}`
    : null;
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
    imageUrl: primaryImage,
    imageUrls,
    videoUrl: row.video_url || null,
    floorPlanUrl: row.floor_plan_url || null,
    listingDetails: row.property_details || {},
    status: row.deleted_at ? 'deleted' : row.status,
    deletedAt: row.deleted_at || null,
    deletedBy: row.deleted_by || null,
    deleteReason: row.delete_reason || null,
    isDeleted: Boolean(row.deleted_at),
    ownerId: row.owner_id || null,
    owner: row.owner_id
      ? {
          id: row.owner_id,
          name: row.owner_name || null,
          email: row.owner_email || null,
          avatarUrl: row.owner_avatar_url || null,
          phone: row.owner_phone || null,
          whatsappCountryCode: ownerWhatsappCountryCode,
          whatsappNumber: ownerWhatsappNumber,
          whatsappPhone: ownerWhatsappPhone,
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listAll() {
  const { rows } = await query(
    `SELECT p.*,
            u.name AS owner_name,
            u.email AS owner_email,
            u.avatar_url AS owner_avatar_url,
            u.phone AS owner_phone,
            u.whatsapp_country_code AS owner_whatsapp_country_code,
            u.whatsapp_number AS owner_whatsapp_number
     FROM properties p
     LEFT JOIN users u ON u.id = p.owner_id
     ORDER BY p.created_at DESC`
  );
  return rows.map(mapProperty);
}

async function listPublished() {
  const { rows } = await query(
    `SELECT p.*,
            u.name AS owner_name,
            u.email AS owner_email,
            u.avatar_url AS owner_avatar_url,
            u.phone AS owner_phone,
            u.whatsapp_country_code AS owner_whatsapp_country_code,
            u.whatsapp_number AS owner_whatsapp_number
     FROM properties p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.status = 'published'
       AND p.deleted_at IS NULL
     ORDER BY p.created_at DESC`
  );
  return rows.map(mapProperty);
}


async function findPublishedById(id) {
  const { rows } = await query(
    `SELECT p.*,
            u.name AS owner_name,
            u.email AS owner_email,
            u.avatar_url AS owner_avatar_url,
            u.phone AS owner_phone,
            u.whatsapp_country_code AS owner_whatsapp_country_code,
            u.whatsapp_number AS owner_whatsapp_number
     FROM properties p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1
       AND p.status = 'published'
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return mapProperty(rows[0]);
}

async function findById(id) {
  const { rows } = await query(
    `SELECT p.*,
            u.name AS owner_name,
            u.email AS owner_email,
            u.avatar_url AS owner_avatar_url,
            u.phone AS owner_phone,
            u.whatsapp_country_code AS owner_whatsapp_country_code,
            u.whatsapp_number AS owner_whatsapp_number
     FROM properties p
     LEFT JOIN users u ON u.id = p.owner_id
     WHERE p.id = $1
       AND p.deleted_at IS NULL
     LIMIT 1`,
    [id]
  );
  return mapProperty(rows[0]);
}

async function updateStatus(id, status) {
  const { rows } = await query(
    `UPDATE properties
       SET status = $2,
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *`,
    [id, status]
  );

  if (!rows[0]) return null;
  return findById(rows[0].id);
}

async function createByOwner(ownerId, payload) {
  const { rows } = await query(
    `INSERT INTO properties
      (
        id, reference_code, title, location, price, status, owner_id,
        property_type, living_area, rooms, address, description,
        image_url, video_url, floor_plan_url, property_details
      )
     VALUES
      ($1, DEFAULT, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15::jsonb)
     RETURNING *`,
    [
      uuid(),
      payload.title,
      payload.location,
      payload.price,
      'pending',
      ownerId,
      payload.propertyType || null,
      payload.livingArea || null,
      payload.rooms || null,
      payload.address || null,
      payload.description || null,
      payload.imageUrl || null,
      payload.videoUrl || null,
      payload.floorPlanUrl || null,
      JSON.stringify(payload.listingDetails || {}),
    ]
  );
  if (!rows[0]) return null;
  return findById(rows[0].id);
}

async function softDeleteById(id, actorUserId, reason = '') {
  const { rows } = await query(
    `UPDATE properties
       SET deleted_at = NOW(),
           deleted_by = $2,
           delete_reason = NULLIF($3, ''),
           updated_at = NOW(),
           status = CASE
             WHEN status IN ('published', 'pending') THEN 'draft'
             ELSE status
           END
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING *`,
    [id, actorUserId || null, String(reason || '').trim()]
  );

  if (!rows[0]) return null;
  return mapProperty(rows[0]);
}

async function restoreById(id) {
  const { rows } = await query(
    `UPDATE properties
       SET deleted_at = NULL,
           deleted_by = NULL,
           delete_reason = NULL,
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NOT NULL
     RETURNING *`,
    [id]
  );
  if (!rows[0]) return null;
  return mapProperty(rows[0]);
}

module.exports = { listAll, listPublished, findPublishedById, findById, updateStatus, createByOwner, softDeleteById, restoreById };
