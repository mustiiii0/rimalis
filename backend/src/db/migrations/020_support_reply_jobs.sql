CREATE TABLE IF NOT EXISTS support_reply_jobs (
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
);

CREATE INDEX IF NOT EXISTS idx_support_reply_jobs_due
  ON support_reply_jobs (status, next_attempt_at, created_at);

CREATE INDEX IF NOT EXISTS idx_support_reply_jobs_message
  ON support_reply_jobs (message_id, created_at DESC);
