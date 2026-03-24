DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'properties_status_check'
      AND conrelid = 'properties'::regclass
  ) THEN
    ALTER TABLE properties DROP CONSTRAINT properties_status_check;
  END IF;
END $$;

ALTER TABLE properties
  ADD CONSTRAINT properties_status_check
  CHECK (status IN ('draft', 'pending', 'published', 'sold', 'rejected'));

CREATE INDEX IF NOT EXISTS idx_properties_status_created_at
  ON properties(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_properties_owner_created_at
  ON properties(owner_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_user_created_at
  ON messages(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_state_created_at
  ON messages(state, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_reviews_status_created_at
  ON reviews(status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_user_scheduled_at
  ON bookings(user_id, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_saved_searches_user_created_at
  ON saved_searches(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user_created_at
  ON refresh_tokens(user_id, created_at DESC);
