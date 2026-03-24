const { query, withTransaction } = require('../../db/client');

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

function mapReview(row) {
  if (!row) return null;
  return {
    id: row.id,
    propertyId: row.property_id,
    status: row.status,
    property: row.property_title
      ? {
          id: row.property_id,
          referenceCode: toReferenceCode(row.property_reference_code, row.property_id),
          title: row.property_title,
          location: row.property_location,
          price: Number(row.property_price),
          propertyStatus: row.property_status,
          ownerId: row.property_owner_id,
          imageUrl: sanitizeAssetUrl(row.property_image_url)
            || (Array.isArray(row.property_details?.imageUrls)
              ? row.property_details.imageUrls.map((x) => sanitizeAssetUrl(x)).find(Boolean) || null
              : null),
        }
      : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function listPending() {
  const { rows } = await query(
    `SELECT r.*,
            p.title AS property_title,
            p.reference_code AS property_reference_code,
            p.location AS property_location,
            p.price AS property_price,
            p.status AS property_status,
            p.owner_id AS property_owner_id,
            p.image_url AS property_image_url,
            p.property_details AS property_details
     FROM reviews r
     JOIN properties p ON p.id = r.property_id
     WHERE r.status = 'pending'
       AND p.deleted_at IS NULL
     ORDER BY r.created_at DESC`
  );
  return rows.map(mapReview);
}

async function setStatus(id, status) {
  return withTransaction(async (client) => {
    const reviewRes = await client.query(
      `UPDATE reviews
         SET status = $2,
             updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status]
    );

    const review = reviewRes.rows[0];
    if (!review) return null;

    // Keep review rows consistent per listing: if one pending review is decided,
    // mirror that decision to any other pending review rows for the same listing.
    await client.query(
      `UPDATE reviews
         SET status = $2,
             updated_at = NOW()
       WHERE property_id = $1
         AND status = 'pending'`,
      [review.property_id, status]
    );

    const propertyStatus = status === 'approved' ? 'published' : 'rejected';
    await client.query(
      `UPDATE properties
         SET status = $2,
             updated_at = NOW()
       WHERE id = $1`,
      [review.property_id, propertyStatus]
    );

    const detailsRes = await client.query(
      `SELECT r.*,
              p.title AS property_title,
              p.reference_code AS property_reference_code,
              p.location AS property_location,
              p.price AS property_price,
              p.status AS property_status,
              p.owner_id AS property_owner_id,
              p.image_url AS property_image_url,
              p.property_details AS property_details
       FROM reviews r
       JOIN properties p ON p.id = r.property_id
       WHERE r.id = $1
       LIMIT 1`,
      [id]
    );

    return mapReview(detailsRes.rows[0]);
  });
}

module.exports = { listPending, setStatus };
