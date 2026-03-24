const { query, withTransaction } = require('../../db/client');
const { v4: uuid } = require('uuid');

let appSettingsSchemaReady = false;
let siteControlsSchemaReady = false;

async function ensureAppSettingsSchema() {
  if (appSettingsSchemaReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS app_settings (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      site_name TEXT NOT NULL DEFAULT 'Rimalis Group',
      support_email TEXT NOT NULL DEFAULT 'support@rimalis.se',
      contact_phone TEXT NOT NULL DEFAULT '',
      smtp_host TEXT NOT NULL DEFAULT '',
      smtp_port INT NOT NULL DEFAULT 587,
      smtp_user TEXT NOT NULL DEFAULT '',
      vat_percent NUMERIC(5,2) NOT NULL DEFAULT 25,
      commission_percent NUMERIC(5,2) NOT NULL DEFAULT 3.5,
      fixed_fee INT NOT NULL DEFAULT 5000,
      session_timeout_min INT NOT NULL DEFAULT 30,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `ALTER TABLE app_settings
      ADD COLUMN IF NOT EXISTS site_name TEXT NOT NULL DEFAULT 'Rimalis Group',
      ADD COLUMN IF NOT EXISTS support_email TEXT NOT NULL DEFAULT 'support@rimalis.se',
      ADD COLUMN IF NOT EXISTS contact_phone TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS smtp_host TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS smtp_port INT NOT NULL DEFAULT 587,
      ADD COLUMN IF NOT EXISTS smtp_user TEXT NOT NULL DEFAULT '',
      ADD COLUMN IF NOT EXISTS vat_percent NUMERIC(5,2) NOT NULL DEFAULT 25,
      ADD COLUMN IF NOT EXISTS commission_percent NUMERIC(5,2) NOT NULL DEFAULT 3.5,
      ADD COLUMN IF NOT EXISTS fixed_fee INT NOT NULL DEFAULT 5000,
      ADD COLUMN IF NOT EXISTS session_timeout_min INT NOT NULL DEFAULT 30,
      ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()`
  );
  await query(
    `INSERT INTO app_settings (id)
     VALUES (1)
     ON CONFLICT (id) DO NOTHING`
  );

  appSettingsSchemaReady = true;
}

async function ensureSiteControlsSchema() {
  if (siteControlsSchemaReady) return;

  await query(
    `CREATE TABLE IF NOT EXISTS site_runtime_controls (
      id SMALLINT PRIMARY KEY DEFAULT 1,
      maintenance_mode BOOLEAN NOT NULL DEFAULT FALSE,
      maintenance_message TEXT NOT NULL DEFAULT '',
      maintenance_starts_at TIMESTAMPTZ,
      maintenance_ends_at TIMESTAMPTZ,
      global_banner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      global_banner_text TEXT NOT NULL DEFAULT '',
      global_banner_level TEXT NOT NULL DEFAULT 'info',
      ab_home_enabled BOOLEAN NOT NULL DEFAULT FALSE,
      active_home_variant TEXT NOT NULL DEFAULT 'a',
      section_controls JSONB NOT NULL DEFAULT '{}'::jsonb,
      content_blocks JSONB NOT NULL DEFAULT '{}'::jsonb,
      redirect_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      access_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
      preview_token TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `INSERT INTO site_runtime_controls (id)
     VALUES (1)
     ON CONFLICT (id) DO NOTHING`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS site_page_controls (
      slug TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      enabled BOOLEAN NOT NULL DEFAULT TRUE,
      show_in_nav BOOLEAN NOT NULL DEFAULT TRUE,
      maintenance_message TEXT NOT NULL DEFAULT '',
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `INSERT INTO site_page_controls (slug, title, enabled, show_in_nav)
     VALUES
      ('home', 'Home', TRUE, TRUE),
      ('properties', 'Properties', TRUE, TRUE),
      ('areas', 'Areas', TRUE, TRUE),
      ('about', 'About', TRUE, TRUE),
      ('contact', 'Contact', TRUE, TRUE),
      ('faq', 'FAQ', TRUE, FALSE),
      ('privacy', 'Privacy policy', TRUE, FALSE),
      ('terms', 'Terms of use', TRUE, FALSE),
      ('cookies', 'Cookies', TRUE, FALSE)
     ON CONFLICT (slug) DO NOTHING`
  );
  await query(
    `ALTER TABLE users
      ADD COLUMN IF NOT EXISTS admin_level TEXT CHECK (admin_level IN ('super', 'content')) DEFAULT 'content'`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS site_control_versions (
      id UUID PRIMARY KEY,
      created_by TEXT,
      note TEXT NOT NULL DEFAULT '',
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_site_control_versions_created_at
       ON site_control_versions(created_at DESC)`
  );

  await query(
    `CREATE TABLE IF NOT EXISTS site_control_audit (
      id UUID PRIMARY KEY,
      actor_user_id TEXT,
      actor_ip TEXT,
      action TEXT NOT NULL,
      payload JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
  await query(
    `DO $$
     BEGIN
       BEGIN
         ALTER TABLE site_control_versions DROP CONSTRAINT IF EXISTS site_control_versions_created_by_fkey;
       EXCEPTION WHEN undefined_table THEN
         NULL;
       END;
       BEGIN
         ALTER TABLE site_control_audit DROP CONSTRAINT IF EXISTS site_control_audit_actor_user_id_fkey;
       EXCEPTION WHEN undefined_table THEN
         NULL;
       END;
       BEGIN
         ALTER TABLE site_control_versions
           ALTER COLUMN created_by TYPE TEXT USING created_by::text;
       EXCEPTION WHEN undefined_column THEN
         NULL;
       END;
       BEGIN
         ALTER TABLE site_control_audit
           ALTER COLUMN actor_user_id TYPE TEXT USING actor_user_id::text;
       EXCEPTION WHEN undefined_column THEN
         NULL;
       END;
     END$$`
  );
  await query(
    `CREATE INDEX IF NOT EXISTS idx_site_control_audit_created_at
       ON site_control_audit(created_at DESC)`
  );

  siteControlsSchemaReady = true;
}

async function getStats() {
  const { rows } = await query(`
    SELECT
      (SELECT COUNT(*)::int FROM users WHERE deleted_at IS NULL) AS total_users,
      (SELECT COUNT(*)::int FROM properties WHERE deleted_at IS NULL) AS total_properties,
      (SELECT COUNT(*)::int FROM reviews WHERE status = 'pending') AS pending_reviews,
      (SELECT COUNT(*)::int FROM messages WHERE state = 'unread') AS total_messages
  `);

  const row = rows[0] || {
    total_users: 0,
    total_properties: 0,
    pending_reviews: 0,
    total_messages: 0,
  };

  return {
    totalUsers: row.total_users,
    totalProperties: row.total_properties,
    pendingReviews: row.pending_reviews,
    totalMessages: row.total_messages,
  };
}

async function listUsers() {
  const { rows } = await query(
    `SELECT u.id,
            u.name,
            u.email,
            u.role,
            u.created_at,
            u.deleted_at,
            MAX(rt.created_at) AS last_login_at
     FROM users u
     LEFT JOIN refresh_tokens rt ON rt.user_id = u.id
     GROUP BY u.id
     ORDER BY u.created_at DESC`
  );

  return rows.map((u) => ({
    id: u.id,
    name: u.name,
    email: u.email,
    role: u.role,
    createdAt: u.created_at,
    status: u.deleted_at ? 'deleted' : 'active',
    deletedAt: u.deleted_at || null,
    lastLoginAt: u.last_login_at || null,
  }));
}

async function findUserByEmail(email) {
  const { rows } = await query('SELECT id FROM users WHERE LOWER(email) = LOWER($1) AND deleted_at IS NULL LIMIT 1', [email]);
  return rows[0] || null;
}

async function createUser(payload) {
  const id = uuid();
  const { rows } = await query(
    `INSERT INTO users (id, name, email, password_hash, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, role, created_at`,
    [id, payload.name, payload.email, payload.passwordHash, payload.role]
  );
  return rows[0] || null;
}

async function updateUserRole(userId, role) {
  const { rows } = await query(
    `UPDATE users
       SET role = $2,
           updated_at = NOW()
     WHERE id = $1
       AND deleted_at IS NULL
     RETURNING id, name, email, role, created_at`,
    [userId, role]
  );
  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    status: 'active',
    lastLoginAt: null,
  };
}

async function softDeleteUser(userId, actorUserId) {
  return withTransaction(async (client) => {
    const userRes = await client.query(
      `UPDATE users
         SET deleted_at = NOW(),
             deleted_by = $2,
             updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NULL
       RETURNING id`,
      [userId, actorUserId || null]
    );
    const user = userRes.rows[0];
    if (!user) return null;

    await client.query(
      `UPDATE properties
         SET deleted_at = NOW(),
             deleted_by = $2,
             delete_reason = COALESCE(delete_reason, 'owner_soft_deleted'),
             updated_at = NOW(),
             status = CASE
               WHEN status IN ('published', 'pending') THEN 'draft'
               ELSE status
             END
       WHERE owner_id = $1
         AND deleted_at IS NULL`,
      [userId, actorUserId || null]
    );
    return user;
  });
}

async function restoreUser(userId) {
  return withTransaction(async (client) => {
    const userRes = await client.query(
      `UPDATE users
         SET deleted_at = NULL,
             deleted_by = NULL,
             delete_reason = NULL,
             updated_at = NOW()
       WHERE id = $1
         AND deleted_at IS NOT NULL
       RETURNING id, name, email, role, created_at`,
      [userId]
    );
    const row = userRes.rows[0];
    if (!row) return null;

    await client.query(
      `UPDATE properties
         SET deleted_at = NULL,
             deleted_by = NULL,
             delete_reason = NULL,
             updated_at = NOW()
       WHERE owner_id = $1
         AND deleted_at IS NOT NULL`,
      [userId]
    );

    return {
      id: row.id,
      name: row.name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      status: 'active',
      deletedAt: null,
      lastLoginAt: null,
    };
  });
}

async function listMessages() {
  const { rows } = await query(
    `SELECT m.id, m.user_id, m.sender_name, m.sender_email, m.sender_phone, m.property_id,
            m.subject, m.content, m.state, m.admin_reply, m.replied_at, m.created_at,
            u.name AS user_name, u.email AS user_email
     FROM messages m
     LEFT JOIN users u ON u.id = m.user_id
     ORDER BY m.created_at DESC`
  );

  return rows.map((m) => ({
    id: m.id,
    userId: m.user_id,
    userName: m.sender_name || m.user_name || 'Okänd',
    userEmail: m.sender_email || m.user_email || null,
    senderPhone: m.sender_phone || null,
    propertyId: m.property_id || null,
    subject: m.subject,
    content: m.content,
    state: m.state,
    adminReply: m.admin_reply,
    repliedAt: m.replied_at,
    createdAt: m.created_at,
  }));
}

async function markMessageRead(messageId) {
  const { rows } = await query(
    `UPDATE messages
       SET state = 'read'
     WHERE id = $1
     RETURNING id, state`,
    [messageId]
  );

  return rows[0] || null;
}

async function replyToMessage(messageId, reply) {
  const { rows } = await query(
    `UPDATE messages
       SET state = 'read',
           admin_reply = $2,
           replied_at = NOW()
     WHERE id = $1
     RETURNING id, state, admin_reply, replied_at`,
    [messageId, reply]
  );

  return rows[0] || null;
}

async function getMessageDeliveryMeta(messageId) {
  let rows;
  try {
    ({ rows } = await query(
      `SELECT m.id, m.subject, m.content, m.sender_name, m.sender_email, m.user_id,
              u.email AS user_email
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.id = $1
        LIMIT 1`,
      [messageId]
    ));
  } catch (err) {
    if (err?.code !== '42703') throw err;
    ({ rows } = await query(
      `SELECT m.id, m.subject, m.content, m.sender_name, m.user_id,
              u.email AS user_email
         FROM messages m
         LEFT JOIN users u ON u.id = m.user_id
        WHERE m.id = $1
        LIMIT 1`,
      [messageId]
    ));
  }

  const row = rows[0];
  if (!row) return null;
  return {
    id: row.id,
    subject: row.subject,
    originalMessage: row.content,
    senderName: row.sender_name || null,
    recipientEmail: row.sender_email || row.user_email || null,
    recipientUserId: row.user_id || null,
  };
}

async function getSettings() {
  await ensureAppSettingsSchema();
  const { rows } = await query('SELECT * FROM app_settings WHERE id = 1 LIMIT 1');
  const s = rows[0];
  if (!s) return null;

  return {
    siteName: s.site_name,
    supportEmail: s.support_email,
    contactPhone: s.contact_phone,
    smtpHost: s.smtp_host,
    smtpPort: s.smtp_port,
    smtpUser: s.smtp_user,
    vatPercent: Number(s.vat_percent),
    commissionPercent: Number(s.commission_percent),
    fixedFee: s.fixed_fee,
    sessionTimeoutMin: s.session_timeout_min,
    updatedAt: s.updated_at,
  };
}

async function updateSettings(payload) {
  await ensureAppSettingsSchema();
  const { rows } = await query(
    `UPDATE app_settings
       SET site_name = $1,
           support_email = $2,
           contact_phone = $3,
           smtp_host = $4,
           smtp_port = $5,
           smtp_user = $6,
           vat_percent = $7,
           commission_percent = $8,
           fixed_fee = $9,
           session_timeout_min = $10,
           updated_at = NOW()
     WHERE id = 1
     RETURNING *`,
    [
      payload.siteName,
      payload.supportEmail,
      payload.contactPhone,
      payload.smtpHost,
      payload.smtpPort,
      payload.smtpUser,
      payload.vatPercent,
      payload.commissionPercent,
      payload.fixedFee,
      payload.sessionTimeoutMin,
    ]
  );

  const s = rows[0];
  if (!s) return getSettings();
  return {
    siteName: s.site_name,
    supportEmail: s.support_email,
    contactPhone: s.contact_phone,
    smtpHost: s.smtp_host,
    smtpPort: s.smtp_port,
    smtpUser: s.smtp_user,
    vatPercent: Number(s.vat_percent),
    commissionPercent: Number(s.commission_percent),
    fixedFee: s.fixed_fee,
    sessionTimeoutMin: s.session_timeout_min,
    updatedAt: s.updated_at,
  };
}



function mapSiteControl(row) {
  return {
    slug: row.slug,
    title: row.title,
    enabled: Boolean(row.enabled),
    showInNav: Boolean(row.show_in_nav),
    maintenanceMessage: row.maintenance_message || '',
    updatedAt: row.updated_at,
  };
}

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function normalizeTextIdOrNull(value) {
  const raw = String(value || '').trim();
  if (!raw) return null;
  return raw;
}

async function listAdminLevels() {
  const { rows } = await query(
    `SELECT id, name, email, role, admin_level
       FROM users
      WHERE role = 'admin'
      ORDER BY created_at ASC`
  );

  return rows.map((row) => ({
    userId: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    adminLevel: row.admin_level || 'content',
  }));
}

async function getSiteControls() {
  await ensureSiteControlsSchema();
  const [runtimeRes, pagesRes, adminLevels] = await Promise.all([
    query(
      `SELECT maintenance_mode, maintenance_message, maintenance_starts_at, maintenance_ends_at,
              global_banner_enabled, global_banner_text, global_banner_level,
              ab_home_enabled, active_home_variant,
              section_controls, content_blocks, redirect_rules, access_rules, preview_token,
              updated_at
         FROM site_runtime_controls
        WHERE id = 1
        LIMIT 1`
    ),
    query('SELECT slug, title, enabled, show_in_nav, maintenance_message, updated_at FROM site_page_controls ORDER BY slug ASC'),
    listAdminLevels(),
  ]);

  const runtime = runtimeRes.rows[0] || {
    maintenance_mode: false,
    maintenance_message: '',
    maintenance_starts_at: null,
    maintenance_ends_at: null,
    global_banner_enabled: false,
    global_banner_text: '',
    global_banner_level: 'info',
    ab_home_enabled: false,
    active_home_variant: 'a',
    section_controls: {},
    content_blocks: {},
    redirect_rules: {},
    access_rules: {},
    preview_token: '',
    updated_at: null,
  };

  return {
    maintenanceMode: Boolean(runtime.maintenance_mode),
    maintenanceMessage: runtime.maintenance_message || '',
    maintenanceStartsAt: runtime.maintenance_starts_at || null,
    maintenanceEndsAt: runtime.maintenance_ends_at || null,
    banner: {
      enabled: Boolean(runtime.global_banner_enabled),
      text: runtime.global_banner_text || '',
      level: runtime.global_banner_level || 'info',
    },
    abHome: {
      enabled: Boolean(runtime.ab_home_enabled),
      activeVariant: runtime.active_home_variant || 'a',
    },
    sectionControls: ensureObject(runtime.section_controls),
    contentBlocks: ensureObject(runtime.content_blocks),
    redirectRules: ensureObject(runtime.redirect_rules),
    accessRules: ensureObject(runtime.access_rules),
    previewToken: runtime.preview_token || '',
    updatedAt: runtime.updated_at,
    pages: pagesRes.rows.map(mapSiteControl),
    adminLevels: Array.isArray(adminLevels) ? adminLevels : [],
  };
}

async function upsertSiteControlVersion(payload, actorUserId, note = '') {
  await ensureSiteControlsSchema();
  const safeActorUserId = normalizeTextIdOrNull(actorUserId);
  await query(
    `INSERT INTO site_control_versions (id, created_by, note, payload)
     VALUES ($1, $2, $3, $4::jsonb)`,
    [uuid(), safeActorUserId, note || '', JSON.stringify(payload || {})]
  );
}

async function addSiteControlAudit(actorUserId, actorIp, action, payload) {
  await ensureSiteControlsSchema();
  const safeActorUserId = normalizeTextIdOrNull(actorUserId);
  await query(
    `INSERT INTO site_control_audit (id, actor_user_id, actor_ip, action, payload)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [uuid(), safeActorUserId, actorIp || null, action, JSON.stringify(payload || {})]
  );
}

async function updateSiteControls(payload, actorUserId = null, actorIp = null) {
  await ensureSiteControlsSchema();
  const previous = await getSiteControls();

  await query(
    `UPDATE site_runtime_controls
        SET maintenance_mode = $1,
            maintenance_message = $2,
            maintenance_starts_at = $3,
            maintenance_ends_at = $4,
            global_banner_enabled = $5,
            global_banner_text = $6,
            global_banner_level = $7,
            ab_home_enabled = $8,
            active_home_variant = $9,
            section_controls = $10::jsonb,
            content_blocks = $11::jsonb,
            redirect_rules = $12::jsonb,
            access_rules = $13::jsonb,
            updated_at = NOW()
      WHERE id = 1`,
    [
      payload.maintenanceMode,
      payload.maintenanceMessage || '',
      payload.maintenanceStartsAt || null,
      payload.maintenanceEndsAt || null,
      Boolean(payload.banner?.enabled),
      payload.banner?.text || '',
      payload.banner?.level || 'info',
      Boolean(payload.abHome?.enabled),
      payload.abHome?.activeVariant || 'a',
      JSON.stringify(ensureObject(payload.sectionControls)),
      JSON.stringify(ensureObject(payload.contentBlocks)),
      JSON.stringify(ensureObject(payload.redirectRules)),
      JSON.stringify(ensureObject(payload.accessRules)),
    ]
  );

  for (const page of payload.pages) {
    await query(
      `UPDATE site_page_controls
          SET enabled = $2,
              show_in_nav = $3,
              maintenance_message = $4,
              updated_at = NOW()
        WHERE slug = $1`,
      [page.slug, page.enabled, page.showInNav, page.maintenanceMessage || '']
    );
  }

  if (Array.isArray(payload.adminLevels) && payload.adminLevels.length) {
    for (const admin of payload.adminLevels) {
      await query(
        `UPDATE users
            SET admin_level = $2
          WHERE id = $1
            AND role = 'admin'`,
        [admin.userId, admin.adminLevel]
      );
    }
  }

  const next = await getSiteControls();
  try {
    await upsertSiteControlVersion(
      { before: previous, after: next },
      actorUserId,
      payload.note || 'save-controls'
    );
    await addSiteControlAudit(actorUserId, actorIp, 'site-controls.updated', {
      note: payload.note || '',
      changedPages: Array.isArray(payload.pages) ? payload.pages.map((p) => p.slug) : [],
    });
  } catch (_err) {
    // Never block main save if versioning/audit insert fails.
  }

  return next;
}

async function listSiteControlVersions(limit = 20) {
  await ensureSiteControlsSchema();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 100) : 20;
  const { rows } = await query(
    `SELECT v.id, v.created_by, v.note, v.payload, v.created_at,
            u.name AS actor_name, u.email AS actor_email
       FROM site_control_versions v
       LEFT JOIN users u ON u.id::text = v.created_by
      ORDER BY v.created_at DESC
      LIMIT $1`,
    [safeLimit]
  );
  return rows.map((row) => ({
    id: row.id,
    note: row.note || '',
    createdAt: row.created_at,
    actorUserId: row.created_by || null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
    payload: row.payload || null,
  }));
}

async function getSiteControlVersion(versionId) {
  await ensureSiteControlsSchema();
  const { rows } = await query(
    `SELECT id, payload
       FROM site_control_versions
      WHERE id = $1
      LIMIT 1`,
    [versionId]
  );
  return rows[0] || null;
}

async function listSiteControlAudit(limit = 50) {
  await ensureSiteControlsSchema();
  const safeLimit = Number.isFinite(limit) ? Math.min(Math.max(Number(limit), 1), 200) : 50;
  const { rows } = await query(
    `SELECT a.id, a.action, a.actor_ip, a.payload, a.created_at,
            a.actor_user_id, u.name AS actor_name, u.email AS actor_email
       FROM site_control_audit a
       LEFT JOIN users u ON u.id::text = a.actor_user_id
      ORDER BY a.created_at DESC
      LIMIT $1`,
    [safeLimit]
  );
  return rows.map((row) => ({
    id: row.id,
    action: row.action,
    actorIp: row.actor_ip || null,
    payload: row.payload || null,
    createdAt: row.created_at,
    actorUserId: row.actor_user_id || null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
  }));
}

async function rotateSitePreviewToken(actorUserId = null, actorIp = null) {
  await ensureSiteControlsSchema();
  const token = uuid();
  await query(
    `UPDATE site_runtime_controls
        SET preview_token = $1,
            updated_at = NOW()
      WHERE id = 1`,
    [token]
  );
  await addSiteControlAudit(actorUserId, actorIp, 'site-controls.preview-token-rotated', {});
  return { token };
}

async function listAdminAuditEntries(filters = {}) {
  const conditions = [`event_type = 'admin.action'`];
  const params = [];

  if (filters.actorUserId) {
    params.push(filters.actorUserId);
    conditions.push(`se.user_id = $${params.length}`);
  }
  if (filters.actionLike) {
    params.push(`%${filters.actionLike}%`);
    conditions.push(`(se.metadata->>'action') ILIKE $${params.length}`);
  }
  if (filters.from) {
    params.push(filters.from);
    conditions.push(`se.created_at >= $${params.length}::timestamptz`);
  }
  if (filters.to) {
    params.push(filters.to);
    conditions.push(`se.created_at <= $${params.length}::timestamptz`);
  }
  if (filters.outcome) {
    params.push(filters.outcome);
    conditions.push(`(se.metadata->>'outcome') = $${params.length}`);
  }

  const limit = Number.isFinite(Number(filters.limit))
    ? Math.min(Math.max(Number(filters.limit), 1), 500)
    : 100;
  params.push(limit);

  const { rows } = await query(
    `SELECT se.id,
            se.event_type,
            se.severity,
            se.user_id,
            se.request_id,
            se.ip_address,
            se.method,
            se.path,
            se.metadata,
            se.created_at,
            u.name AS actor_name,
            u.email AS actor_email
       FROM security_events se
       LEFT JOIN users u ON u.id = se.user_id
      WHERE ${conditions.join(' AND ')}
      ORDER BY se.created_at DESC
      LIMIT $${params.length}`,
    params
  );

  return rows.map((row) => ({
    id: row.id,
    eventType: row.event_type,
    severity: row.severity,
    actorUserId: row.user_id || null,
    actorName: row.actor_name || null,
    actorEmail: row.actor_email || null,
    requestId: row.request_id || null,
    ipAddress: row.ip_address || null,
    method: row.method || null,
    path: row.path || null,
    metadata: row.metadata || {},
    createdAt: row.created_at,
  }));
}

async function listLargestListingsByImageCount(limit = 10) {
  const safeLimit = Number.isFinite(Number(limit))
    ? Math.min(Math.max(Number(limit), 1), 50)
    : 10;

  const { rows } = await query(
    `SELECT id, reference_code, title, image_url, property_details, created_at, updated_at
       FROM properties
      ORDER BY updated_at DESC NULLS LAST, created_at DESC
      LIMIT 2000`
  );

  const mapped = rows.map((row) => {
    const urls = [];
    if (typeof row.image_url === 'string' && row.image_url.trim()) urls.push(row.image_url.trim());
    if (Array.isArray(row.property_details?.imageUrls)) {
      row.property_details.imageUrls.forEach((url) => {
        if (typeof url === 'string' && url.trim()) urls.push(url.trim());
      });
    }
    const uniqueUrls = [...new Set(urls)];
    const referencedKeys = uniqueUrls
      .map((url) => String(url || '').trim())
      .filter(Boolean)
      .map((url) => {
        if (url.startsWith('/static/')) return url.slice('/static/'.length);
        if (url.startsWith('/')) return url.slice(1);
        return url;
      })
      .filter((key) => key.startsWith('uploads/'));
    return {
      id: row.id,
      referenceCode: row.reference_code || null,
      title: row.title || row.id,
      imageCount: uniqueUrls.length,
      primaryImage: uniqueUrls[0] || null,
      hasPrimaryImage: Boolean(typeof row.image_url === 'string' && row.image_url.trim()),
      referencedKeys,
      updatedAt: row.updated_at || row.created_at || null,
    };
  });

  return mapped
    .sort((a, b) => b.imageCount - a.imageCount)
    .slice(0, safeLimit);
}

module.exports = {
  getStats,
  listUsers,
  findUserByEmail,
  createUser,
  updateUserRole,
  softDeleteUser,
  restoreUser,
  listMessages,
  markMessageRead,
  replyToMessage,
  getMessageDeliveryMeta,
  getSettings,
  updateSettings,
  listAdminLevels,
  getSiteControls,
  updateSiteControls,
  listSiteControlVersions,
  getSiteControlVersion,
  listSiteControlAudit,
  rotateSitePreviewToken,
  listAdminAuditEntries,
  listLargestListingsByImageCount,
};
