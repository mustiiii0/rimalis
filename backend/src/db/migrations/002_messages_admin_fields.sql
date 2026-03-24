ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS state TEXT NOT NULL DEFAULT 'unread' CHECK (state IN ('unread', 'read')),
  ADD COLUMN IF NOT EXISTS admin_reply TEXT,
  ADD COLUMN IF NOT EXISTS replied_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_messages_state ON messages(state);
