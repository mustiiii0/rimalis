const { query } = require('../../db/client');

function ensureObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function mapControl(row) {
  return {
    slug: row.slug,
    title: row.title,
    enabled: Boolean(row.enabled),
    showInNav: Boolean(row.show_in_nav),
    maintenanceMessage: row.maintenance_message || '',
    updatedAt: row.updated_at,
  };
}

async function getSiteControls(previewToken = '') {
  const [runtimeRes, pagesRes] = await Promise.all([
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

  const previewAuthorized = Boolean(runtime.preview_token) && String(previewToken || '') === String(runtime.preview_token);

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
    previewAuthorized,
    updatedAt: runtime.updated_at,
    pages: pagesRes.rows.map(mapControl),
  };
}

module.exports = { getSiteControls };
