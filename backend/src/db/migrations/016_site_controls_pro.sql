ALTER TABLE users
  ADD COLUMN IF NOT EXISTS admin_level TEXT CHECK (admin_level IN ('super', 'content')) DEFAULT 'content';

WITH first_admin AS (
  SELECT id
    FROM users
   WHERE role = 'admin'
   ORDER BY created_at ASC
   LIMIT 1
)
UPDATE users
   SET admin_level = 'super'
 WHERE id IN (SELECT id FROM first_admin)
   AND role = 'admin';

UPDATE users
   SET admin_level = COALESCE(admin_level, 'content')
 WHERE role = 'admin';

ALTER TABLE site_runtime_controls
  ADD COLUMN IF NOT EXISTS maintenance_starts_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS maintenance_ends_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS global_banner_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS global_banner_text TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS global_banner_level TEXT NOT NULL DEFAULT 'info',
  ADD COLUMN IF NOT EXISTS ab_home_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS active_home_variant TEXT NOT NULL DEFAULT 'a',
  ADD COLUMN IF NOT EXISTS section_controls JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS content_blocks JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS redirect_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS access_rules JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preview_token TEXT NOT NULL DEFAULT '';

CREATE TABLE IF NOT EXISTS site_control_versions (
  id UUID PRIMARY KEY,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  note TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_control_versions_created_at
  ON site_control_versions(created_at DESC);

CREATE TABLE IF NOT EXISTS site_control_audit (
  id UUID PRIMARY KEY,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  actor_ip TEXT,
  action TEXT NOT NULL,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_site_control_audit_created_at
  ON site_control_audit(created_at DESC);
