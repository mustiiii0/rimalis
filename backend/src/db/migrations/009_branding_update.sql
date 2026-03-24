ALTER TABLE app_settings
  ALTER COLUMN site_name SET DEFAULT 'Rimalis Group';

UPDATE app_settings
SET site_name = 'Rimalis Group'
WHERE site_name ILIKE 'rimalis%';

