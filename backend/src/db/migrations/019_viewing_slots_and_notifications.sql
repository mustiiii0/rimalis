CREATE TABLE IF NOT EXISTS viewing_slots (
  id UUID PRIMARY KEY,
  property_id TEXT NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
  owner_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  starts_at TIMESTAMPTZ NOT NULL,
  ends_at TIMESTAMPTZ NOT NULL,
  capacity INT NOT NULL DEFAULT 1 CHECK (capacity > 0 AND capacity <= 50),
  booked_count INT NOT NULL DEFAULT 0 CHECK (booked_count >= 0),
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'closed', 'cancelled')),
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(property_id, starts_at)
);

CREATE INDEX IF NOT EXISTS idx_viewing_slots_property_time
  ON viewing_slots(property_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_viewing_slots_owner_time
  ON viewing_slots(owner_user_id, starts_at);

CREATE INDEX IF NOT EXISTS idx_viewing_slots_status
  ON viewing_slots(status);

ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS slot_id UUID REFERENCES viewing_slots(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bookings_slot_id
  ON bookings(slot_id);

CREATE TABLE IF NOT EXISTS notifications (
  id UUID PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications(user_id, is_read, created_at DESC);
