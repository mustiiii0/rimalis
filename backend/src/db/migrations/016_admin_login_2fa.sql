CREATE TABLE IF NOT EXISTS admin_login_challenges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_user
  ON admin_login_challenges (user_id);

CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_expires
  ON admin_login_challenges (expires_at);

DELETE FROM admin_login_challenges
WHERE expires_at < NOW() - INTERVAL '7 days'
   OR consumed_at IS NOT NULL;
