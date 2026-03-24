CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'warning', 'critical')),
  user_id UUID,
  request_id TEXT,
  ip_address TEXT,
  method TEXT,
  path TEXT,
  user_agent TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_security_events_type_created_at
  ON security_events(event_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_severity_created_at
  ON security_events(severity, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_security_events_user_id
  ON security_events(user_id);
