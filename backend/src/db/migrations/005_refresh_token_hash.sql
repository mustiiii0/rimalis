CREATE EXTENSION IF NOT EXISTS pgcrypto;

ALTER TABLE refresh_tokens
  ADD COLUMN IF NOT EXISTS token_hash TEXT;

UPDATE refresh_tokens
SET token_hash = encode(digest(token, 'sha256'), 'hex')
WHERE token_hash IS NULL
  AND token IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_refresh_tokens_token_hash_unique
  ON refresh_tokens(token_hash);

ALTER TABLE refresh_tokens
  ALTER COLUMN token DROP NOT NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'refresh_tokens_token_key'
      AND conrelid = 'refresh_tokens'::regclass
  ) THEN
    ALTER TABLE refresh_tokens DROP CONSTRAINT refresh_tokens_token_key;
  END IF;
END $$;
