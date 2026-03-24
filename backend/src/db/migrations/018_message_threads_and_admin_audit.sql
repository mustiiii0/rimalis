CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS message_replies (
  id UUID PRIMARY KEY,
  message_id UUID NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
  author_type TEXT NOT NULL CHECK (author_type IN ('public', 'owner', 'admin')),
  author_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_message_replies_message_created
  ON message_replies(message_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_message_replies_author_user
  ON message_replies(author_user_id, created_at DESC);

-- Seed legacy rows so old messages become proper threads.
INSERT INTO message_replies (id, message_id, author_type, author_user_id, content, created_at)
SELECT
  gen_random_uuid(),
  m.id,
  CASE
    WHEN COALESCE(NULLIF(TRIM(m.sender_name), ''), NULLIF(TRIM(m.sender_email), ''), NULLIF(TRIM(m.sender_phone), '')) IS NOT NULL
      THEN 'public'
    ELSE 'owner'
  END AS author_type,
  CASE
    WHEN COALESCE(NULLIF(TRIM(m.sender_name), ''), NULLIF(TRIM(m.sender_email), ''), NULLIF(TRIM(m.sender_phone), '')) IS NOT NULL
      THEN NULL
    ELSE m.user_id
  END AS author_user_id,
  COALESCE(NULLIF(m.content, ''), '(empty)') AS content,
  m.created_at
FROM messages m
WHERE NOT EXISTS (
  SELECT 1
  FROM message_replies mr
  WHERE mr.message_id = m.id
);
