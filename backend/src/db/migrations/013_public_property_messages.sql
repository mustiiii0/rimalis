ALTER TABLE messages
  ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE messages
  ADD COLUMN IF NOT EXISTS sender_name TEXT,
  ADD COLUMN IF NOT EXISTS sender_email TEXT,
  ADD COLUMN IF NOT EXISTS sender_phone TEXT,
  ADD COLUMN IF NOT EXISTS property_id TEXT;

CREATE INDEX IF NOT EXISTS idx_messages_property_created_at
  ON messages(property_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_sender_email
  ON messages(LOWER(sender_email));
