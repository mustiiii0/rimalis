const { v4: uuid } = require('uuid');
const { query } = require('../../db/client');

function mapNotification(row) {
  if (!row) return null;
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    title: row.title,
    body: row.body,
    entityType: row.entity_type || null,
    entityId: row.entity_id || null,
    metadata: row.metadata || {},
    isRead: Boolean(row.is_read),
    readAt: row.read_at || null,
    createdAt: row.created_at,
  };
}

async function createNotification(payload) {
  const { rows } = await query(
    `INSERT INTO notifications
      (id, user_id, type, title, body, entity_type, entity_id, metadata)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8::jsonb)
     RETURNING *`,
    [
      uuid(),
      payload.userId,
      payload.type,
      payload.title,
      payload.body,
      payload.entityType || null,
      payload.entityId || null,
      JSON.stringify(payload.metadata || {}),
    ]
  );
  return mapNotification(rows[0]);
}

async function listByUser(userId, limit = 50) {
  const { rows } = await query(
    `SELECT *
       FROM notifications
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT $2`,
    [userId, Number(limit) || 50]
  );
  return rows.map(mapNotification);
}

async function markRead(userId, notificationId) {
  const { rows } = await query(
    `UPDATE notifications
        SET is_read = TRUE,
            read_at = NOW()
      WHERE id = $1
        AND user_id = $2
      RETURNING *`,
    [notificationId, userId]
  );
  return mapNotification(rows[0]);
}

async function markAllRead(userId) {
  const { rowCount } = await query(
    `UPDATE notifications
        SET is_read = TRUE,
            read_at = NOW()
      WHERE user_id = $1
        AND is_read = FALSE`,
    [userId]
  );
  return rowCount;
}

async function countUnread(userId) {
  const { rows } = await query(
    `SELECT COUNT(*)::int AS unread_count
       FROM notifications
      WHERE user_id = $1
        AND is_read = FALSE`,
    [userId]
  );
  return rows[0]?.unread_count || 0;
}

module.exports = {
  createNotification,
  listByUser,
  markRead,
  markAllRead,
  countUnread,
};
