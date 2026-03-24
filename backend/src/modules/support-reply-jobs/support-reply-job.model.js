const { v4: uuid } = require('uuid');
const { query, withTransaction } = require('../../db/client');

async function ensureTableExists() {
  await query(
    `CREATE TABLE IF NOT EXISTS support_reply_jobs (
      id UUID PRIMARY KEY,
      message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
      admin_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      recipient_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
      recipient_email TEXT,
      subject TEXT NOT NULL,
      original_message TEXT NOT NULL,
      reply_text TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'retry', 'processing', 'sent', 'failed')),
      attempts INT NOT NULL DEFAULT 0,
      max_attempts INT NOT NULL DEFAULT 7,
      next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      last_error TEXT,
      sent_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_support_reply_jobs_due
       ON support_reply_jobs (status, next_attempt_at, created_at)`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_support_reply_jobs_message
       ON support_reply_jobs (message_id, created_at DESC)`
  );
}

async function enqueue(payload) {
  const values = [
    uuid(),
    payload.messageId,
    payload.adminUserId || null,
    payload.recipientUserId || null,
    payload.recipientEmail || null,
    payload.subject,
    payload.originalMessage,
    payload.replyText,
    payload.maxAttempts || 7,
  ];
  const sql = `INSERT INTO support_reply_jobs
      (id, message_id, admin_user_id, recipient_user_id, recipient_email, subject, original_message, reply_text, status, attempts, max_attempts, next_attempt_at)
     VALUES
      ($1, $2, $3, $4, $5, $6, $7, $8, 'pending', 0, $9, NOW())
     RETURNING *`;

  try {
    const { rows } = await query(sql, values);
    return rows[0] || null;
  } catch (err) {
    if (err?.code !== '42P01') throw err;
    await ensureTableExists();
    const { rows } = await query(sql, values);
    return rows[0] || null;
  }
}

async function claimDue(limit = 5) {
  const safeLimit = Number.isFinite(Number(limit)) ? Math.min(Math.max(Number(limit), 1), 50) : 5;

  return withTransaction(async (client) => {
    const { rows } = await client.query(
      `WITH picked AS (
         SELECT id
           FROM support_reply_jobs
          WHERE status IN ('pending', 'retry')
            AND next_attempt_at <= NOW()
          ORDER BY next_attempt_at ASC, created_at ASC
          LIMIT $1
          FOR UPDATE SKIP LOCKED
       )
       UPDATE support_reply_jobs j
          SET status = 'processing',
              attempts = attempts + 1,
              updated_at = NOW()
         FROM picked
        WHERE j.id = picked.id
      RETURNING j.*`,
      [safeLimit]
    );

    return rows;
  });
}

async function markSent(jobId) {
  await query(
    `UPDATE support_reply_jobs
        SET status = 'sent',
            sent_at = NOW(),
            updated_at = NOW(),
            last_error = NULL
      WHERE id = $1`,
    [jobId]
  );
}

async function markRetry(jobId, opts) {
  await query(
    `UPDATE support_reply_jobs
        SET status = $2,
            next_attempt_at = $3,
            updated_at = NOW(),
            last_error = $4
      WHERE id = $1`,
    [jobId, opts.status, opts.nextAttemptAt, opts.error || null]
  );
}

module.exports = {
  enqueue,
  claimDue,
  markSent,
  markRetry,
};
