const { query } = require('../../db/client');

function sanitizeAssetUrl(url) {
  if (typeof url !== 'string') return null;
  const trimmed = url.trim();
  if (!trimmed) return null;
  if (
    trimmed.startsWith('http://') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('/static/uploads/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('data:image/')
  ) {
    return trimmed;
  }
  return null;
}

function toReferenceCode(rawCode, id) {
  if (rawCode && /^RG8-\d{4}$/.test(String(rawCode))) return String(rawCode);
  const source = String(id || '');
  let hash = 0;
  for (let i = 0; i < source.length; i += 1) {
    hash = (hash * 31 + source.charCodeAt(i)) >>> 0;
  }
  return `RG8-${String(hash % 10000).padStart(4, '0')}`;
}

async function listByUser(userId) {
  const { rows } = await query(
    `SELECT f.user_id,
            f.property_id,
            f.created_at,
            p.title,
            p.location,
            p.price,
            p.status,
            p.image_url,
            p.property_details,
            p.reference_code
     FROM favorites f
     JOIN properties p ON p.id = f.property_id AND p.deleted_at IS NULL
     WHERE f.user_id = $1
     ORDER BY f.created_at DESC`,
    [userId]
  );

  return rows.map((row) => ({
    ...(function () {
      const extraImages = Array.isArray(row.property_details?.imageUrls)
        ? row.property_details.imageUrls
            .map((x) => sanitizeAssetUrl(x))
            .filter(Boolean)
        : [];
      return {
        imageUrl: sanitizeAssetUrl(row.image_url) || extraImages[0] || null,
        imageUrls: extraImages,
      };
    })(),
    userId: row.user_id,
    propertyId: row.property_id,
    title: row.title || null,
    location: row.location || null,
    price: row.price != null ? Number(row.price) : null,
    status: row.status || null,
    referenceCode: toReferenceCode(row.reference_code, row.property_id),
    createdAt: row.created_at,
  }));
}

async function add(userId, propertyId) {
  await query(
    `INSERT INTO favorites (user_id, property_id)
     SELECT $1, p.id
     FROM properties p
     WHERE p.id = $2
       AND p.deleted_at IS NULL
     ON CONFLICT (user_id, property_id) DO NOTHING`,
    [userId, propertyId]
  );
  return listByUser(userId);
}

async function remove(userId, propertyId) {
  await query('DELETE FROM favorites WHERE user_id = $1 AND property_id = $2', [
    userId,
    propertyId,
  ]);
  return listByUser(userId);
}

module.exports = { listByUser, add, remove };
