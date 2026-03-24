ALTER TABLE properties
  ADD COLUMN IF NOT EXISTS reference_code TEXT;

WITH numbered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY created_at ASC, id ASC) AS rn
  FROM properties
  WHERE reference_code IS NULL
)
UPDATE properties p
SET reference_code = 'RG8-' || LPAD(numbered.rn::text, 4, '0')
FROM numbered
WHERE p.id = numbered.id;

CREATE UNIQUE INDEX IF NOT EXISTS uq_properties_reference_code
  ON properties(reference_code);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_class
    WHERE relkind = 'S'
      AND relname = 'properties_reference_code_seq'
  ) THEN
    CREATE SEQUENCE properties_reference_code_seq START WITH 1;
  END IF;
END $$;

SELECT setval(
  'properties_reference_code_seq',
  GREATEST(
    COALESCE((
      SELECT MAX((regexp_match(reference_code, '^RG8-(\d+)$'))[1]::INT)
      FROM properties
      WHERE reference_code ~ '^RG8-\d+$'
    ), 0),
    1
  ),
  true
);

ALTER TABLE properties
  ALTER COLUMN reference_code SET DEFAULT ('RG8-' || LPAD(nextval('properties_reference_code_seq')::TEXT, 4, '0'));

ALTER TABLE properties
  ALTER COLUMN reference_code SET NOT NULL;
