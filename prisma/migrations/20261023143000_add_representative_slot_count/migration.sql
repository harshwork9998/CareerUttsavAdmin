-- Admin-owned event representative allocation.
-- Existing representative JSON is left in place.
ALTER TABLE "partner_event_partnerships"
ADD COLUMN "representativeSlotCount" INTEGER NOT NULL DEFAULT 0;

-- Seed the new allocation from the partner-submitted count so current
-- forms stay the same until an admin changes the number.
UPDATE "partner_event_partnerships" AS partnership
SET "representativeSlotCount" = seeded.slot_count
FROM (
  SELECT
    partnership_row.id,
    GREATEST(
      0,
      COALESCE(
        CASE
          WHEN jsonb_typeof(partner."portalRepresentatives") = 'array' THEN (
            SELECT FLOOR((elem->>'count')::numeric)::int
            FROM jsonb_array_elements(partner."portalRepresentatives") AS elem
            WHERE elem->>'eventId' = partnership_row."eventId"
              AND (elem->>'count') ~ '^[0-9]+(\.0+)?$'
            LIMIT 1
          )
          WHEN jsonb_typeof(partner."portalRepresentatives") = 'object'
            AND (
              partner."portalRepresentatives"->>'eventId' IS NULL
              OR partner."portalRepresentatives"->>'eventId' = ''
              OR partner."portalRepresentatives"->>'eventId' = partnership_row."eventId"
            )
            AND (partner."portalRepresentatives"->>'count') ~ '^[0-9]+(\.0+)?$'
          THEN FLOOR((partner."portalRepresentatives"->>'count')::numeric)::int
          ELSE NULL
        END,
        0
      )
    ) AS slot_count
  FROM "partner_event_partnerships" AS partnership_row
  JOIN "partners" AS partner ON partner.id = partnership_row."partnerId"
) AS seeded
WHERE partnership.id = seeded.id;
