ALTER TABLE bookings
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS checked_in_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS attendance_status TEXT NOT NULL DEFAULT 'pending'
    CHECK (attendance_status IN ('pending', 'attended', 'no_show')),
  ADD COLUMN IF NOT EXISTS reminder_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_2h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sms_24h_sent_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS reminder_sms_2h_sent_at TIMESTAMPTZ;

CREATE TABLE IF NOT EXISTS booking_events (
  id UUID PRIMARY KEY,
  booking_id UUID NOT NULL REFERENCES bookings(id) ON DELETE CASCADE,
  actor_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  note TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_booking_events_booking_created
  ON booking_events(booking_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_bookings_status_scheduled
  ON bookings(status, scheduled_at);

CREATE INDEX IF NOT EXISTS idx_bookings_property_scheduled
  ON bookings(property_id, scheduled_at DESC);
