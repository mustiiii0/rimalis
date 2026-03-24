CREATE TABLE IF NOT EXISTS admin_login_challenges (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  attempts INT NOT NULL DEFAULT 0,
  ip_address TEXT,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_user_id
  ON admin_login_challenges(user_id);

CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_expires_at
  ON admin_login_challenges(expires_at);

CREATE INDEX IF NOT EXISTS idx_admin_login_challenges_unconsumed
  ON admin_login_challenges(consumed_at)
  WHERE consumed_at IS NULL;
