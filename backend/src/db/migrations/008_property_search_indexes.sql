CREATE INDEX IF NOT EXISTS idx_properties_title_lower
  ON properties (LOWER(title));

CREATE INDEX IF NOT EXISTS idx_properties_location_lower
  ON properties (LOWER(location));

CREATE INDEX IF NOT EXISTS idx_properties_status_price
  ON properties (status, price);

