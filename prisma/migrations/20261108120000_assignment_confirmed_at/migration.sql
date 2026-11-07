-- Per-topic confirmation. Partner.seminarSlotsConfirmedAt stays the latest completed cycle.
ALTER TABLE "partner_seminar_slot_assignments"
ADD COLUMN "confirmedAt" TIMESTAMP(3);

-- U+2060 WORD JOINER was the Phase 2 development marker. It is not part of a title.
-- If a partner still has any marked title, only those marked rows were confirmed.
-- Otherwise every assignment owned by a partner who already confirmed is confirmed.
UPDATE "partner_seminar_slot_assignments" AS assignment
SET "confirmedAt" = partner."seminarSlotsConfirmedAt"
FROM "partner_event_partnerships" AS partnership
JOIN "partners" AS partner ON partner.id = partnership."partnerId"
WHERE assignment."partnershipId" = partnership.id
  AND assignment."confirmedAt" IS NULL
  AND partner."seminarSlotsConfirmedAt" IS NOT NULL
  AND (
    NOT EXISTS (
      SELECT 1
      FROM "partner_seminar_slot_assignments" AS sibling
      JOIN "partner_event_partnerships" AS sibling_partnership
        ON sibling_partnership.id = sibling."partnershipId"
      WHERE sibling_partnership."partnerId" = partner.id
        AND position(chr(8288) IN coalesce(sibling."seminarTitle", '')) > 0
    )
    OR position(chr(8288) IN coalesce(assignment."seminarTitle", '')) > 0
  );

UPDATE "partner_seminar_slot_assignments"
SET "seminarTitle" = NULLIF(replace("seminarTitle", chr(8288), ''), '')
WHERE position(chr(8288) IN coalesce("seminarTitle", '')) > 0;
