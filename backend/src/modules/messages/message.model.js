const { v4: uuid } = require('uuid');
const { query, withTransaction } = require('../../db/client');

let ensureMessagesColumnsPromise = null;
let ensureSupportOpsSchemaPromise = null;

function ensureMessagesColumns() {
  if (ensureMessagesColumnsPromise) return ensureMessagesColumnsPromise;
  ensureMessagesColumnsPromise = (async () => {
    await query(
      `ALTER TABLE messages
         ADD COLUMN IF NOT EXISTS admin_reply TEXT,
         ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ,
         ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
    );
  })().catch((err) => {
    ensureMessagesColumnsPromise = null;
    throw err;
  });
  return ensureMessagesColumnsPromise;
}

function ensureSupportOpsSchema() {
  if (ensureSupportOpsSchemaPromise) return ensureSupportOpsSchemaPromise;
  ensureSupportOpsSchemaPromise = (async () => {
    await query(
      `CREATE TABLE IF NOT EXISTS support_thread_meta (
        message_id UUID PRIMARY KEY REFERENCES messages(id) ON DELETE CASCADE,
        assignee_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'waiting_customer', 'resolved', 'closed')),
        priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high', 'urgent')),
        closed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await query(
      `CREATE TABLE IF NOT EXISTS support_thread_notes (
        id UUID PRIMARY KEY,
        message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
        author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        note TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
    await query(
      `CREATE TABLE IF NOT EXISTS support_reply_macros (
        id UUID PRIMARY KEY,
        name TEXT NOT NULL,
        body TEXT NOT NULL,
        created_by UUID REFERENCES users(id) ON DELETE SET NULL,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`
    );
  })().catch((err) => {
    ensureSupportOpsSchemaPromise = null;
    throw err;
  });
  return ensureSupportOpsSchemaPromise;
}

function normalizePhone(value) {
  return String(value || '').replace(/[^\d+]/g, '').trim();
}

function mapReply(row) {
  return {
    id: row.id,
    messageId: row.message_id,
    authorType: row.author_type,
    authorUserId: row.author_user_id || null,
    authorName: row.author_name || null,
    content: row.content,
    createdAt: row.created_at,
  };
}

function mapMessage(row, repliesByMessageId = new Map()) {
  const joinedImageUrls = Array.isArray(row.property_details_joined?.imageUrls)
    ? row.property_details_joined.imageUrls.filter((value) => typeof value === 'string' && value.trim())
    : [];
  return {
    id: row.id,
    userId: row.user_id,
    senderName: row.sender_name || null,
    senderEmail: row.sender_email || null,
    senderPhone: row.sender_phone || null,
    propertyId: row.property_id || null,
    propertyTitle: row.property_title || null,
    propertyImage: row.property_image_url || joinedImageUrls[0] || null,
    publicToken: row.public_token || null,
    subject: row.subject,
    content: row.content,
    state: row.state,
    adminReply: row.admin_reply,
    repliedAt: row.replied_at,
    createdAt: row.created_at,
    thread: repliesByMessageId.get(row.id) || [],
  };
}

async function lookupPropertyForMessage(propertyId) {
  const { rows } = await query(
    `SELECT id, title, reference_code, owner_id
       FROM properties
      WHERE id = $1
      LIMIT 1`,
    [propertyId]
  );
  return rows[0] || null;
}

async function resolveMessageRecipientUserId(property) {
  if (property?.owner_id) return property.owner_id;

  const { rows } = await query(
    `SELECT id
       FROM users
      ORDER BY CASE WHEN role = 'admin' THEN 0 ELSE 1 END, created_at ASC
      LIMIT 1`
  );
  return rows[0]?.id || null;
}

async function listRepliesByMessageIds(messageIds) {
  if (!Array.isArray(messageIds) || !messageIds.length) return new Map();
  const { rows } = await query(
    `SELECT mr.*,
            u.name AS author_name
       FROM message_replies mr
       LEFT JOIN users u ON u.id = mr.author_user_id
      WHERE mr.message_id = ANY($1::uuid[])
      ORDER BY mr.created_at ASC`,
    [messageIds]
  );

  const grouped = new Map();
  rows.forEach((row) => {
    const list = grouped.get(row.message_id) || [];
    list.push(mapReply(row));
    grouped.set(row.message_id, list);
  });
  return grouped;
}

async function createReplyTx(client, payload) {
  const { rows } = await client.query(
    `INSERT INTO message_replies (id, message_id, author_type, author_user_id, content)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING *`,
    [uuid(), payload.messageId, payload.authorType, payload.authorUserId || null, payload.content]
  );
  return rows[0] || null;
}

async function getParticipantProfile(userId) {
  const { rows } = await query(
    `SELECT id, name, email, phone
       FROM users
      WHERE id = $1
      LIMIT 1`,
    [userId]
  );
  return rows[0] || null;
}

function buildParticipantWhere(profile, startIndex = 2) {
  const clauses = [`user_id = $1`];
  const params = [];
  let idx = startIndex;

  const email = String(profile?.email || '').trim().toLowerCase();
  const phone = normalizePhone(profile?.phone);
  const name = String(profile?.name || '').trim();

  if (email) {
    clauses.push(`LOWER(sender_email) = LOWER($${idx})`);
    params.push(email);
    idx += 1;
  }
  if (phone) {
    clauses.push(`sender_phone = $${idx}`);
    params.push(phone);
    idx += 1;
  }
  if (name) {
    clauses.push(`sender_name = $${idx}`);
    params.push(name);
  }

  return { sql: clauses.join(' OR '), params };
}

async function listByUser(userId) {
  const profile = await getParticipantProfile(userId);
  const participant = buildParticipantWhere(profile, 2);
  const { rows } = await query(
    `SELECT m.*,
            p.title AS property_title,
            p.image_url AS property_image_url,
            p.property_details AS property_details_joined
       FROM messages
       m
       LEFT JOIN properties p ON p.id = m.property_id
      WHERE ${participant.sql}
      ORDER BY m.created_at DESC`,
    [userId, ...participant.params]
  );
  const messageIds = rows.map((row) => row.id);
  const repliesByMessageId = await listRepliesByMessageIds(messageIds);
  return rows.map((row) => mapMessage(row, repliesByMessageId));
}

async function getByIdAndUser(messageId, userId) {
  const profile = await getParticipantProfile(userId);
  const participant = buildParticipantWhere(profile, 3);
  const { rows } = await query(
    `SELECT m.*,
            p.title AS property_title,
            p.image_url AS property_image_url,
            p.property_details AS property_details_joined
       FROM messages m
       LEFT JOIN properties p ON p.id = m.property_id
      WHERE m.id = $1
        AND (${participant.sql.replace(/\$1/g, '$2')})
      LIMIT 1`,
    [messageId, userId, ...participant.params]
  );
  const row = rows[0];
  if (!row) return null;
  const repliesByMessageId = await listRepliesByMessageIds([row.id]);
  return mapMessage(row, repliesByMessageId);
}

async function deleteByIdAndUser(messageId, userId) {
  const profile = await getParticipantProfile(userId);
  const participant = buildParticipantWhere(profile, 3);
  const { rows } = await query(
    `DELETE FROM messages
      WHERE id = $1
        AND (${participant.sql.replace(/\$1/g, '$2')})
      RETURNING id`,
    [messageId, userId, ...participant.params]
  );
  return rows[0]?.id || null;
}

async function createMessage(userId, payload) {
  return withTransaction(async (client) => {
    const messageId = uuid();
    await client.query(
      `INSERT INTO messages (id, user_id, subject, content, state)
       VALUES ($1, $2, $3, $4, 'unread')`,
      [messageId, userId, payload.subject, payload.content]
    );

    await createReplyTx(client, {
      messageId,
      authorType: 'owner',
      authorUserId: userId,
      content: payload.content,
    });

    const ref = await client.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = ref.rows[0];
    const repliesByMessageId = await listRepliesByMessageIds([messageId]);
    return mapMessage(row, repliesByMessageId);
  });
}

async function replyAsOwner(userId, messageId, content) {
  await ensureMessagesColumns();
  return withTransaction(async (client) => {
    const profile = await getParticipantProfile(userId);
    const participant = buildParticipantWhere(profile, 3);
    const msgRes = await client.query(
      `SELECT *
         FROM messages
        WHERE id = $1
          AND (${participant.sql.replace(/\$1/g, '$2')})
        LIMIT 1`,
      [messageId, userId, ...participant.params]
    );
    const message = msgRes.rows[0];
    if (!message) return null;

    await createReplyTx(client, {
      messageId,
      authorType: message.user_id === userId ? 'owner' : 'public',
      authorUserId: message.user_id === userId ? userId : null,
      content,
    });

    await client.query(
      `UPDATE messages
          SET state = 'unread',
              updated_at = NOW()
        WHERE id = $1`,
      [messageId]
    );

    const ref = await client.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = ref.rows[0];
    const repliesByMessageId = await listRepliesByMessageIds([messageId]);
    return mapMessage(row, repliesByMessageId);
  });
}

async function findOpenPublicChatMessage(payload) {
  const contactClauses = [];
  const params = [payload.propertyId];
  let idx = 2;

  if (payload.email) {
    contactClauses.push(`LOWER(sender_email) = LOWER($${idx})`);
    params.push(payload.email);
    idx += 1;
  }
  if (payload.phone) {
    contactClauses.push(`sender_phone = $${idx}`);
    params.push(payload.phone);
    idx += 1;
  }
  if (!contactClauses.length) return null;

  const { rows } = await query(
    `SELECT *
       FROM messages
      WHERE property_id = $1
        AND (${contactClauses.join(' OR ')})
      ORDER BY created_at DESC
      LIMIT 1`,
    params
  );

  return rows[0] || null;
}

async function appendPublicChatMessage(existingRow, payload) {
  await ensureMessagesColumns();
  return withTransaction(async (client) => {
    const fallbackToken = uuid();
    await client.query(
      `UPDATE messages
          SET state = 'unread',
              sender_name = $2::text,
              sender_email = COALESCE(NULLIF($3::text, ''), sender_email),
              sender_phone = COALESCE(NULLIF($4::text, ''), sender_phone),
              public_token = COALESCE(public_token, $5::text),
              created_at = NOW(),
              content = $6::text
        WHERE id = $1`,
      [
        existingRow.id,
        payload.name,
        payload.email || '',
        payload.phone || '',
        fallbackToken,
        payload.message,
      ]
    );

    await createReplyTx(client, {
      messageId: existingRow.id,
      authorType: 'public',
      authorUserId: null,
      content: payload.message,
    });

    const ref = await client.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [existingRow.id]);
    const row = ref.rows[0] || existingRow;
    const repliesByMessageId = await listRepliesByMessageIds([row.id]);
    return mapMessage(row, repliesByMessageId);
  });
}

async function createPublicMessage(payload) {
  const normalizedPayload = {
    ...payload,
    email: String(payload.email || '').toLowerCase().trim(),
    phone: normalizePhone(payload.phone),
  };

  const property = await lookupPropertyForMessage(payload.propertyId);
  const isChatTicket = String(normalizedPayload.propertyId || '').startsWith('chat:');
  if (isChatTicket) {
    const existingChatMessage = await findOpenPublicChatMessage(normalizedPayload);
    if (existingChatMessage) {
      return appendPublicChatMessage(existingChatMessage, normalizedPayload);
    }
  }

  const subjectBase = property?.title || normalizedPayload.propertyId;
  const referenceText = property?.reference_code ? ` (${property.reference_code})` : '';
  const subject = isChatTicket
    ? `Webbchatt: ${subjectBase}`
    : `Intresseanmälan: ${subjectBase}${referenceText}`;

  const recipientUserId = await resolveMessageRecipientUserId(property);
  if (!recipientUserId) {
    throw new Error('No recipient found for public message');
  }

  return withTransaction(async (client) => {
    const messageId = uuid();
    const publicToken = uuid();

    await client.query(
      `INSERT INTO messages (id, user_id, sender_name, sender_email, sender_phone, property_id, public_token, subject, content, state)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'unread')`,
      [
        messageId,
        recipientUserId,
        normalizedPayload.name,
        normalizedPayload.email || null,
        normalizedPayload.phone || null,
        normalizedPayload.propertyId,
        publicToken,
        subject,
        normalizedPayload.message,
      ]
    );

    await createReplyTx(client, {
      messageId,
      authorType: 'public',
      authorUserId: null,
      content: normalizedPayload.message,
    });

    const ref = await client.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = ref.rows[0];
    const repliesByMessageId = await listRepliesByMessageIds([messageId]);
    return mapMessage(row, repliesByMessageId);
  });
}

async function getPublicMessage(messageId, token) {
  const { rows } = await query(
    `SELECT *
       FROM messages
      WHERE id = $1
        AND public_token = $2
      LIMIT 1`,
    [messageId, token]
  );
  return rows[0] || null;
}

async function replyAsPublic(messageId, token, payload) {
  await ensureMessagesColumns();
  return withTransaction(async (client) => {
    const messageRes = await client.query(
      `SELECT *
         FROM messages
        WHERE id = $1
          AND public_token = $2
        LIMIT 1`,
      [messageId, token]
    );
    const message = messageRes.rows[0];
    if (!message) return null;

    await client.query(
      `UPDATE messages
          SET state = 'unread',
              sender_name = COALESCE(NULLIF($2::text, ''), sender_name),
              sender_email = COALESCE(NULLIF($3::text, ''), sender_email),
              sender_phone = COALESCE(NULLIF($4::text, ''), sender_phone),
              content = $5::text,
              updated_at = NOW()
        WHERE id = $1`,
      [messageId, payload.name || '', payload.email || '', payload.phone || '', payload.content]
    );

    await createReplyTx(client, {
      messageId,
      authorType: 'public',
      authorUserId: null,
      content: payload.content,
    });

    const ref = await client.query('SELECT * FROM messages WHERE id = $1 LIMIT 1', [messageId]);
    const row = ref.rows[0];
    const repliesByMessageId = await listRepliesByMessageIds([messageId]);
    return mapMessage(row, repliesByMessageId);
  });
}

async function replyAsAdmin(messageId, adminUserId, reply) {
  await ensureMessagesColumns();
  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `UPDATE messages
          SET state = 'read',
              admin_reply = $2,
              replied_at = NOW(),
              updated_at = NOW()
        WHERE id = $1
        RETURNING *`,
      [messageId, reply]
    );
    const message = rows[0];
    if (!message) return null;

    await createReplyTx(client, {
      messageId,
      authorType: 'admin',
      authorUserId: adminUserId,
      content: reply,
    });

    const repliesByMessageId = await listRepliesByMessageIds([messageId]);
    return mapMessage(message, repliesByMessageId);
  });
}

async function markRead(messageId) {
  await ensureMessagesColumns();
  const { rows } = await query(
    `UPDATE messages
        SET state = 'read',
            updated_at = NOW()
      WHERE id = $1
      RETURNING id, state`,
    [messageId]
  );
  return rows[0] || null;
}

async function getPublicReply(messageId, token) {
  const message = await getPublicMessage(messageId, token);
  if (!message) return null;

  const replyRes = await query(
    `SELECT mr.*, u.name AS author_name
       FROM message_replies mr
       LEFT JOIN users u ON u.id = mr.author_user_id
      WHERE mr.message_id = $1
      ORDER BY mr.created_at ASC`,
    [messageId]
  );
  const replies = replyRes.rows.map(mapReply);
  const latestStaffReply = [...replies].reverse().find((r) => r.authorType === 'owner' || r.authorType === 'admin') || null;

  return {
    id: message.id,
    state: message.state,
    adminReply: latestStaffReply?.content || null,
    repliedAt: latestStaffReply?.createdAt || null,
    createdAt: message.created_at,
    thread: replies,
  };
}

async function listAllForAdmin() {
  await ensureSupportOpsSchema();
  const { rows } = await query(
    `SELECT m.id, m.user_id, m.sender_name, m.sender_email, m.sender_phone, m.property_id,
            m.subject, m.content, m.state, m.admin_reply, m.replied_at, m.created_at,
            u.name AS user_name, u.email AS user_email,
            stm.assignee_user_id, stm.status AS thread_status, stm.priority AS thread_priority, stm.closed_at,
            au.name AS assignee_name, au.email AS assignee_email,
            COALESCE(notes.note_count, 0)::int AS note_count
       FROM messages m
       LEFT JOIN users u ON u.id = m.user_id
       LEFT JOIN support_thread_meta stm ON stm.message_id = m.id
       LEFT JOIN users au ON au.id = stm.assignee_user_id
       LEFT JOIN (
         SELECT message_id, COUNT(*) AS note_count
           FROM support_thread_notes
          GROUP BY message_id
       ) notes ON notes.message_id = m.id
      ORDER BY m.created_at DESC`
  );

  const messageIds = rows.map((row) => row.id);
  const repliesByMessageId = await listRepliesByMessageIds(messageIds);

  return rows.map((row) => ({
    ...mapMessage(row, repliesByMessageId),
    userName: row.sender_name || row.user_name || 'Okänd',
    userEmail: row.sender_email || row.user_email || null,
    senderPhone: row.sender_phone || null,
    threadMeta: {
      assigneeUserId: row.assignee_user_id || null,
      assigneeName: row.assignee_name || null,
      assigneeEmail: row.assignee_email || null,
      status: row.thread_status || 'open',
      priority: row.thread_priority || 'normal',
      closedAt: row.closed_at || null,
      noteCount: Number(row.note_count || 0),
    },
  }));
}

async function listSupportAgents() {
  const { rows } = await query(
    `SELECT id, name, email
       FROM users
      WHERE role = 'admin'
      ORDER BY name ASC, created_at ASC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    email: row.email,
  }));
}

async function updateThreadMeta(messageId, updates = {}) {
  await ensureSupportOpsSchema();
  await query(
    `INSERT INTO support_thread_meta (message_id)
     VALUES ($1)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId]
  );

  const sets = [];
  const params = [messageId];
  const push = (value) => {
    params.push(value);
    return `$${params.length}`;
  };

  if (Object.prototype.hasOwnProperty.call(updates, 'assigneeUserId')) {
    sets.push(`assignee_user_id = ${push(updates.assigneeUserId || null)}::uuid`);
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'status')) {
    sets.push(`status = ${push(updates.status)}`);
    if (String(updates.status || '') === 'closed') {
      sets.push('closed_at = NOW()');
    } else {
      sets.push('closed_at = NULL');
    }
  }
  if (Object.prototype.hasOwnProperty.call(updates, 'priority')) {
    sets.push(`priority = ${push(updates.priority)}`);
  }
  if (!sets.length) {
    const current = await getThreadMeta(messageId);
    return current;
  }

  sets.push('updated_at = NOW()');
  await query(
    `UPDATE support_thread_meta
        SET ${sets.join(', ')}
      WHERE message_id = $1`,
    params
  );
  return getThreadMeta(messageId);
}

async function getThreadMeta(messageId) {
  await ensureSupportOpsSchema();
  const { rows } = await query(
    `SELECT stm.message_id, stm.assignee_user_id, stm.status, stm.priority, stm.closed_at,
            au.name AS assignee_name, au.email AS assignee_email,
            COALESCE(notes.note_count, 0)::int AS note_count
       FROM support_thread_meta stm
       LEFT JOIN users au ON au.id = stm.assignee_user_id
       LEFT JOIN (
         SELECT message_id, COUNT(*) AS note_count
           FROM support_thread_notes
          GROUP BY message_id
       ) notes ON notes.message_id = stm.message_id
      WHERE stm.message_id = $1
      LIMIT 1`,
    [messageId]
  );
  const row = rows[0];
  if (!row) {
    return {
      messageId,
      assigneeUserId: null,
      assigneeName: null,
      assigneeEmail: null,
      status: 'open',
      priority: 'normal',
      closedAt: null,
      noteCount: 0,
    };
  }
  return {
    messageId: row.message_id,
    assigneeUserId: row.assignee_user_id || null,
    assigneeName: row.assignee_name || null,
    assigneeEmail: row.assignee_email || null,
    status: row.status || 'open',
    priority: row.priority || 'normal',
    closedAt: row.closed_at || null,
    noteCount: Number(row.note_count || 0),
  };
}

async function listThreadNotes(messageId) {
  await ensureSupportOpsSchema();
  const { rows } = await query(
    `SELECT n.id, n.message_id, n.author_user_id, n.note, n.created_at,
            u.name AS author_name
       FROM support_thread_notes n
       LEFT JOIN users u ON u.id = n.author_user_id
      WHERE n.message_id = $1
      ORDER BY n.created_at DESC`,
    [messageId]
  );
  return rows.map((row) => ({
    id: row.id,
    messageId: row.message_id,
    authorUserId: row.author_user_id || null,
    authorName: row.author_name || null,
    note: row.note,
    createdAt: row.created_at,
  }));
}

async function addThreadNote(messageId, authorUserId, note) {
  await ensureSupportOpsSchema();
  const id = uuid();
  await query(
    `INSERT INTO support_thread_notes (id, message_id, author_user_id, note)
     VALUES ($1, $2, $3, $4)`,
    [id, messageId, authorUserId || null, note]
  );
  await query(
    `INSERT INTO support_thread_meta (message_id)
     VALUES ($1)
     ON CONFLICT (message_id) DO NOTHING`,
    [messageId]
  );
  await query(
    `UPDATE support_thread_meta
        SET updated_at = NOW()
      WHERE message_id = $1`,
    [messageId]
  );
  return listThreadNotes(messageId);
}

async function listMacros() {
  await ensureSupportOpsSchema();
  const { rows } = await query(
    `SELECT m.id, m.name, m.body, m.created_by, m.created_at, m.updated_at, u.name AS created_by_name
       FROM support_reply_macros m
       LEFT JOIN users u ON u.id = m.created_by
      ORDER BY m.created_at DESC`
  );
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    body: row.body,
    createdBy: row.created_by || null,
    createdByName: row.created_by_name || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}

async function createMacro({ name, body, createdBy }) {
  await ensureSupportOpsSchema();
  const { rows } = await query(
    `INSERT INTO support_reply_macros (id, name, body, created_by, updated_at)
     VALUES ($1, $2, $3, $4, NOW())
     RETURNING id, name, body, created_by, created_at, updated_at`,
    [uuid(), name, body, createdBy || null]
  );
  const row = rows[0];
  return {
    id: row.id,
    name: row.name,
    body: row.body,
    createdBy: row.created_by || null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

async function deleteMacro(macroId) {
  await ensureSupportOpsSchema();
  const { rowCount } = await query(
    `DELETE FROM support_reply_macros
      WHERE id = $1`,
    [macroId]
  );
  return rowCount > 0;
}

module.exports = {
  listByUser,
  getByIdAndUser,
  deleteByIdAndUser,
  createMessage,
  createPublicMessage,
  replyAsOwner,
  replyAsPublic,
  replyAsAdmin,
  markRead,
  getPublicReply,
  getPublicMessage,
  listAllForAdmin,
  listSupportAgents,
  updateThreadMeta,
  getThreadMeta,
  listThreadNotes,
  addThreadNote,
  listMacros,
  createMacro,
  deleteMacro,
};
