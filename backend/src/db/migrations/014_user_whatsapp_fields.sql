ALTER TABLE users
  ADD COLUMN IF NOT EXISTS whatsapp_country_code TEXT,
  ADD COLUMN IF NOT EXISTS whatsapp_number TEXT;

