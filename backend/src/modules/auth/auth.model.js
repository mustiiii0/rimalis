const { v4: uuid } = require('uuid');
const crypto = require('crypto');
const { query } = require('../../db/client');

function mapUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    passwordHash: row.password_hash,
    role: row.role,
    createdAt: row.created_at,
  };
}

async function findUserByEmail(email) {
  const { rows } = await query(
    'SELECT * FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1',
    [email]
  );
  return mapUser(rows[0]);
}

async function findUserById(id) {
  const { rows } = await query('SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL LIMIT 1', [id]);
  return mapUser(rows[0]);
}

async function createUser({ name, email, passwordHash, role, phone }) {
  const id = uuid();
  const { rows } = await query(
    `INSERT INTO users (id, name, email, password_hash, role, phone)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [id, name, email, passwordHash, role, phone || null]
  );
  return mapUser(rows[0]);
}

async function createAdminLoginChallenge({ userId, codeHash, expiresAt, ipAddress, userAgent }) {
  const id = uuid();
  await query(
    `INSERT INTO admin_login_challenges (id, user_id, code_hash, expires_at, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [id, userId, codeHash, expiresAt, ipAddress || null, userAgent || null]
  );
  return id;
}

async function findAdminLoginChallengeById(id) {
  const { rows } = await query(
    `SELECT id, user_id, code_hash, expires_at, consumed_at, attempts
     FROM admin_login_challenges
     WHERE id = $1
     LIMIT 1`,
    [id]
  );
  return rows[0] || null;
}

async function incrementAdminLoginChallengeAttempts(id) {
  await query(
    `UPDATE admin_login_challenges
     SET attempts = attempts + 1,
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

async function consumeAdminLoginChallenge(id) {
  await query(
    `UPDATE admin_login_challenges
     SET consumed_at = NOW(),
         updated_at = NOW()
     WHERE id = $1`,
    [id]
  );
}

async function saveRefreshToken({ userId, token }) {
  const tokenHash = hashToken(token);
  await query(
    'INSERT INTO refresh_tokens (id, user_id, token, token_hash) VALUES ($1, $2, NULL, $3)',
    [uuid(), userId, tokenHash]
  );
}

async function hasRefreshToken(token) {
  const tokenHash = hashToken(token);
  const { rows } = await query(
    'SELECT 1 FROM refresh_tokens WHERE token_hash = $1 LIMIT 1',
    [tokenHash]
  );
  return rows.length > 0;
}

async function revokeRefreshToken(token) {
  const tokenHash = hashToken(token);
  await query('DELETE FROM refresh_tokens WHERE token_hash = $1', [tokenHash]);
}

async function revokeRefreshTokensForUser(userId) {
  await query('DELETE FROM refresh_tokens WHERE user_id = $1', [userId]);
}

module.exports = {
  findUserByEmail,
  findUserById,
  createUser,
  createAdminLoginChallenge,
  findAdminLoginChallengeById,
  incrementAdminLoginChallengeAttempts,
  consumeAdminLoginChallenge,
  saveRefreshToken,
  hasRefreshToken,
  revokeRefreshToken,
  revokeRefreshTokensForUser,
};
function hashToken(token) {
  return crypto.createHash('sha256').update(String(token)).digest('hex');
}
