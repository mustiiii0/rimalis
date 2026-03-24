-- Backfill publisherName in property_details for existing listings.
-- We only write when owner exists and publisherName is missing/empty.
UPDATE properties p
SET property_details = jsonb_set(
  COALESCE(p.property_details, '{}'::jsonb),
  '{publisherName}',
  to_jsonb(u.name),
  true
)
FROM users u
WHERE p.owner_id = u.id
  AND u.name IS NOT NULL
  AND btrim(u.name) <> ''
  AND (
    p.property_details IS NULL
    OR NOT (p.property_details ? 'publisherName')
    OR p.property_details->>'publisherName' IS NULL
    OR btrim(p.property_details->>'publisherName') = ''
  );
