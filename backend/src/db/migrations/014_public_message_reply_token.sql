ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS public_token TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_public_token
  ON messages(public_token);
