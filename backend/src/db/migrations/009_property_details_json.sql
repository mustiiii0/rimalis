ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS property_details JSONB NOT NULL DEFAULT '{}'::jsonb;

