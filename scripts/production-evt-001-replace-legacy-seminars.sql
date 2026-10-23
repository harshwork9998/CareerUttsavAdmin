-- evt-001 legacy seminar replacement.
-- Decisions below are filled. Do not execute until an operator runs it.
--
-- Approved actions:
--   DELETE 997eo0v5r, including its stored schedule.
--   DELETE_ASSIGNMENT pssa-partner-001-sem-001-a and pssa-partner-001-sem-001-b.
--   DELETE_ROSTER evt-001 / sem-001-a.
--   STRIP portal entries whose seminarId is a legacy id for partner-001.
--   Keep registration_seminars.seminarTitle and set those seminarId values to NULL.
--   Leave completed WhatsApp selectedSeminarIds unchanged.
--
-- No legacy assignment, roster, or portal entry is migrated to a canonical seminar.
-- Final committed state is sem-2026-01..sem-2026-14 only, with schedule fields NULL.
-- Partner slot deletion protection in the application is unchanged.
-- The roster DELETE is explicit, so seminar ON DELETE CASCADE is not what removes it.

BEGIN;

CREATE TEMP TABLE legacy_seminar (
  id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO legacy_seminar (id) VALUES
  ('sem-001-a'),
  ('sem-001-b'),
  ('sem-001-c'),
  ('sem-001-d'),
  ('zyhwu550q');

CREATE TEMP TABLE retired_seminar (
  id text PRIMARY KEY
) ON COMMIT DROP;

INSERT INTO retired_seminar (id)
SELECT id FROM legacy_seminar
UNION ALL
SELECT '997eo0v5r';

CREATE TEMP TABLE canonical_schedule (
  id text PRIMARY KEY,
  title text NOT NULL,
  seminar_date text,
  start_time text,
  end_time text,
  hall integer,
  panelist_slots integer
) ON COMMIT DROP;

INSERT INTO canonical_schedule (
  id, title, seminar_date, start_time, end_time, hall, panelist_slots
) VALUES
  ('sem-2026-01', 'Do What You Love, Love What You Do', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-02', 'Engineering Next: What’s Ahead?', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-03', 'Design, Architecture & Creative Careers', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-04', 'The Future of Management Careers', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-05', 'Liberal Arts: Careers Without Limits', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-06', 'Careers in Commerce & Finance', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-07', 'Your Journey to Study Abroad', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-08', 'Careers in Medicine & Health Sciences', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-09', 'Building a Successful Career in Law', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-10', 'Startups, Leadership & Entrepreneurship', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-11', 'How to Fund Your Higher Education', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-12', 'Engineering: Careers of the Future', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-13', 'Careers Beyond the Usual', NULL, NULL, NULL, NULL, NULL),
  ('sem-2026-14', 'How to Score Better in Board Exams?', NULL, NULL, NULL, NULL, NULL);

-- Approved decisions. A live reference that is not listed here aborts.
-- Do not invent canonical_seminar_id values. Migration is not approved.

CREATE TEMP TABLE noncanonical_row_decision (
  seminar_id text PRIMARY KEY,
  action text NOT NULL CHECK (action = 'DELETE_ROW')
) ON COMMIT DROP;

-- 997eo0v5r duplicates the canonical title and is not sem-2026-01.
-- Its schedule is not copied onto the canonical row.
INSERT INTO noncanonical_row_decision (seminar_id, action) VALUES
  ('997eo0v5r', 'DELETE_ROW');

CREATE TEMP TABLE partner_assignment_decision (
  assignment_id text PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('MIGRATE_TO_CANONICAL', 'DELETE_ASSIGNMENT')),
  canonical_seminar_id text,
  CHECK (
    (action = 'DELETE_ASSIGNMENT' AND canonical_seminar_id IS NULL)
    OR (
      action = 'MIGRATE_TO_CANONICAL'
      AND canonical_seminar_id IS NOT NULL
    )
  )
) ON COMMIT DROP;

-- Christ University, partnership pep-partner-001-evt-001. No canonical mapping.
INSERT INTO partner_assignment_decision (assignment_id, action, canonical_seminar_id) VALUES
  ('pssa-partner-001-sem-001-a', 'DELETE_ASSIGNMENT', NULL),
  ('pssa-partner-001-sem-001-b', 'DELETE_ASSIGNMENT', NULL);

CREATE TEMP TABLE roster_decision (
  event_id text NOT NULL,
  legacy_seminar_id text NOT NULL,
  action text NOT NULL CHECK (action IN ('MIGRATE_TO_CANONICAL', 'DELETE_ROSTER')),
  canonical_seminar_id text,
  PRIMARY KEY (event_id, legacy_seminar_id),
  CHECK (
    (action = 'DELETE_ROSTER' AND canonical_seminar_id IS NULL)
    OR (
      action = 'MIGRATE_TO_CANONICAL'
      AND canonical_seminar_id IS NOT NULL
    )
  )
) ON COMMIT DROP;

-- Retired with sem-001-a. Panelists and moderator are not copied forward.
INSERT INTO roster_decision (event_id, legacy_seminar_id, action, canonical_seminar_id) VALUES
  ('evt-001', 'sem-001-a', 'DELETE_ROSTER', NULL);

CREATE TEMP TABLE portal_speaker_decision (
  partner_id text PRIMARY KEY,
  action text NOT NULL CHECK (action IN ('STRIP_LEGACY_SEMINAR_IDS', 'LEAVE_STALE_IDS'))
) ON COMMIT DROP;

-- partner-001 Christ University. Remove array entries whose seminarId is legacy.
-- Remaining entries stay unchanged. No canonical seminar id is written.
INSERT INTO portal_speaker_decision (partner_id, action) VALUES
  ('partner-001', 'STRIP_LEGACY_SEMINAR_IDS');

DO $$
DECLARE
  unexpected_ids text;
BEGIN
  IF (SELECT count(*) FROM canonical_schedule) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 canonical rows in canonical_schedule.';
  END IF;

  IF (SELECT count(*) FROM retired_seminar) <> 6 THEN
    RAISE EXCEPTION 'Expected six retired seminar ids.';
  END IF;

  IF (
    SELECT count(*) FROM noncanonical_row_decision
    WHERE seminar_id = '997eo0v5r' AND action = 'DELETE_ROW'
  ) <> 1
  OR (SELECT count(*) FROM noncanonical_row_decision) <> 1 THEN
    RAISE EXCEPTION 'The only approved extra-row action is DELETE_ROW for 997eo0v5r.';
  END IF;

  IF (SELECT count(*) FROM partner_assignment_decision) <> 2
     OR EXISTS (
       SELECT 1 FROM partner_assignment_decision
       WHERE action <> 'DELETE_ASSIGNMENT' OR canonical_seminar_id IS NOT NULL
     )
     OR (
       SELECT count(*) FROM partner_assignment_decision
       WHERE assignment_id IN (
         'pssa-partner-001-sem-001-a',
         'pssa-partner-001-sem-001-b'
       )
     ) <> 2 THEN
    RAISE EXCEPTION 'Approved partner actions are DELETE_ASSIGNMENT for the two Christ University rows only.';
  END IF;

  IF (SELECT count(*) FROM roster_decision) <> 1
     OR EXISTS (
       SELECT 1 FROM roster_decision
       WHERE event_id <> 'evt-001'
          OR legacy_seminar_id <> 'sem-001-a'
          OR action <> 'DELETE_ROSTER'
          OR canonical_seminar_id IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'The only approved roster action is DELETE_ROSTER for evt-001 / sem-001-a.';
  END IF;

  IF (SELECT count(*) FROM portal_speaker_decision) <> 1
     OR EXISTS (
       SELECT 1 FROM portal_speaker_decision
       WHERE partner_id <> 'partner-001'
          OR action <> 'STRIP_LEGACY_SEMINAR_IDS'
     ) THEN
    RAISE EXCEPTION 'The only approved portal action is STRIP_LEGACY_SEMINAR_IDS for partner-001.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM seminars
    WHERE id = '997eo0v5r'
      AND "eventId" = 'evt-001'
      AND title = 'Do What You Love, Love What You Do'
  ) THEN
    RAISE EXCEPTION '997eo0v5r is not the expected duplicate canonical-title row.';
  END IF;

  IF NOT EXISTS (SELECT 1 FROM events WHERE id = 'evt-001') THEN
    RAISE EXCEPTION 'evt-001 does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminars s
    JOIN canonical_schedule c ON c.id = s.id
  ) THEN
    RAISE EXCEPTION 'One or more canonical seminar ids already exist.';
  END IF;

  IF (
    SELECT count(*) FROM (
      SELECT id, title, date, "startTime", "endTime", hall, "panelistSlots"
      FROM seminars
      WHERE id IN (SELECT id FROM legacy_seminar)
      INTERSECT
      SELECT * FROM (VALUES
        ('sem-001-a', 'How to select a stream – Art – Science – Commerce?', '2026-12-19', '10:00', '11:00', 1, 4),
        ('sem-001-b', 'Real Careers with Artificial Intelligence', '2026-12-19', '11:30', '12:30', 2, 2),
        ('sem-001-c', 'All about Overseas Education', '2026-12-19', '10:00', '11:00', 1, 4),
        ('sem-001-d', 'Medicine in the 21st century', '2026-12-19', '14:00', '15:00', 2, 3),
        ('zyhwu550q', 'Architecture - A Promising Creative Career', '2026-12-20', '10:00', '11:00', 1, 2)
      ) AS expected(id, title, date, "startTime", "endTime", hall, "panelistSlots")
    ) AS unchanged
  ) <> 5 THEN
    RAISE EXCEPTION 'evt-001 legacy seminar snapshot does not match. Aborting.';
  END IF;

  IF (
    SELECT count(*) FROM seminars WHERE id IN (SELECT id FROM legacy_seminar)
  ) <> 5 THEN
    RAISE EXCEPTION 'Expected exactly five legacy seminar rows.';
  END IF;

  SELECT string_agg(s.id, ', ' ORDER BY s.id)
  INTO unexpected_ids
  FROM seminars s
  WHERE s."eventId" = 'evt-001'
    AND s.id NOT IN (SELECT id FROM legacy_seminar)
    AND s.id NOT IN (SELECT seminar_id FROM noncanonical_row_decision);

  IF unexpected_ids IS NOT NULL THEN
    RAISE EXCEPTION
      'evt-001 has seminar ids outside the five legacy rows and no DELETE_ROW decision: %.',
      unexpected_ids;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM noncanonical_row_decision d
    LEFT JOIN seminars s ON s.id = d.seminar_id AND s."eventId" = 'evt-001'
    WHERE s.id IS NULL
       OR s.id IN (SELECT id FROM legacy_seminar)
       OR s.id IN (SELECT id FROM canonical_schedule)
  ) THEN
    RAISE EXCEPTION 'A noncanonical DELETE_ROW decision does not match an extra evt-001 seminar.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM whatsapp_registration_conversations
    WHERE status::text NOT IN ('COMPLETED', 'CANCELLED')
      AND EXISTS (
        SELECT 1
        FROM retired_seminar retired
        WHERE "selectedSeminarIds" @> to_jsonb(retired.id)
      )
  ) THEN
    RAISE EXCEPTION 'An active or incomplete WhatsApp conversation still references a retired seminar id.';
  END IF;
END $$;

-- Extra evt-001 rows may be deleted only when a decision says so and they
-- have no registration, partner, roster, or WhatsApp reference.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM noncanonical_row_decision d
    JOIN registration_seminars r ON r."seminarId" = d.seminar_id
  ) OR EXISTS (
    SELECT 1
    FROM noncanonical_row_decision d
    JOIN partner_seminar_slot_assignments a ON a."seminarId" = d.seminar_id
  ) OR EXISTS (
    SELECT 1
    FROM noncanonical_row_decision d
    JOIN seminar_session_rosters roster ON roster."seminarId" = d.seminar_id
  ) OR EXISTS (
    SELECT 1
    FROM noncanonical_row_decision d
    JOIN whatsapp_registration_conversations c
      ON c."selectedSeminarIds" @> to_jsonb(d.seminar_id)
  ) THEN
    RAISE EXCEPTION 'Refusing to delete a non-canonical seminar that still has references.';
  END IF;
END $$;

DELETE FROM seminars s
USING noncanonical_row_decision d
WHERE s.id = d.seminar_id
  AND s."eventId" = 'evt-001';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM seminars s
    WHERE s."eventId" = 'evt-001'
      AND s.id NOT IN (SELECT id FROM legacy_seminar)
  ) THEN
    RAISE EXCEPTION 'evt-001 still has rows other than the five legacy seminars.';
  END IF;

  IF (SELECT count(*) FROM seminars WHERE "eventId" = 'evt-001') <> 5 THEN
    RAISE EXCEPTION 'evt-001 must be exactly the five legacy seminars before the canonical insert.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminars s
    JOIN canonical_schedule c ON c.title = s.title
  ) THEN
    RAISE EXCEPTION 'A canonical seminar title already exists.';
  END IF;
END $$;

INSERT INTO seminars (
  id, "eventId", title, date, "startTime", "endTime", hall, "panelistSlots"
)
SELECT
  id,
  'evt-001',
  title,
  seminar_date,
  start_time,
  end_time,
  hall,
  panelist_slots
FROM canonical_schedule
ORDER BY id;

CREATE TEMP TABLE registration_title_snapshot ON COMMIT DROP AS
SELECT id, "registrationId", "seminarId" AS previous_seminar_id, "seminarTitle"
FROM registration_seminars
WHERE "seminarId" IN (SELECT id FROM legacy_seminar);

CREATE TEMP TABLE registration_unrelated_snapshot ON COMMIT DROP AS
SELECT id, "registrationId", "seminarId", "seminarTitle"
FROM registration_seminars
WHERE id NOT IN (SELECT id FROM registration_title_snapshot);

DO $$
DECLARE
  legacy_registration_rows integer;
BEGIN
  SELECT count(*) INTO legacy_registration_rows FROM registration_title_snapshot;
  IF legacy_registration_rows <> 11 THEN
    RAISE EXCEPTION
      'Expected 11 historical registration-interest rows pointing at legacy seminars, found %.',
      legacy_registration_rows;
  END IF;
END $$;

CREATE TEMP TABLE registration_history_guard ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM registration_seminars) AS registration_seminar_rows,
  (SELECT md5(COALESCE(string_agg(id || '|' || "seminarTitle", E'\n' ORDER BY id), ''))
     FROM registration_seminars) AS registration_title_md5,
  (SELECT md5(COALESCE(string_agg(id || '|' || "seminarInterests"::text, E'\n' ORDER BY id), ''))
     FROM registration_attempts) AS attempt_interest_md5,
  (SELECT md5(COALESCE(string_agg(id || '|' || "selectedSeminarIds"::text, E'\n' ORDER BY id), ''))
     FROM whatsapp_registration_conversations) AS whatsapp_md5;

UPDATE registration_seminars
SET "seminarId" = NULL
WHERE "seminarId" IN (SELECT id FROM legacy_seminar);

DO $$
DECLARE
  missing_partner_decisions text;
  missing_roster_decisions text;
  missing_portal_decisions text;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM registration_title_snapshot snap
    JOIN registration_seminars live ON live.id = snap.id
    WHERE live."seminarTitle" IS DISTINCT FROM snap."seminarTitle"
       OR live."seminarId" IS NOT NULL
       OR live."registrationId" IS DISTINCT FROM snap."registrationId"
  ) OR (
    SELECT count(*) FROM registration_seminars
    WHERE id IN (SELECT id FROM registration_title_snapshot)
  ) <> (SELECT count(*) FROM registration_title_snapshot)
  OR (SELECT count(*) FROM registration_title_snapshot) <> 11 THEN
    RAISE EXCEPTION 'Historical registration titles were not preserved.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_unrelated_snapshot snap
    JOIN registration_seminars live ON live.id = snap.id
    WHERE live."seminarTitle" IS DISTINCT FROM snap."seminarTitle"
       OR live."seminarId" IS DISTINCT FROM snap."seminarId"
       OR live."registrationId" IS DISTINCT FROM snap."registrationId"
  ) OR (
    SELECT count(*) FROM registration_unrelated_snapshot
  ) <> (
    SELECT count(*) FROM registration_seminars
    WHERE id IN (SELECT id FROM registration_unrelated_snapshot)
  ) THEN
    RAISE EXCEPTION 'An unrelated registration seminar row changed.';
  END IF;

  IF (
    SELECT count(*) FROM partner_seminar_slot_assignments
    WHERE (id, "seminarId") IN (
      ('pssa-partner-001-sem-001-a', 'sem-001-a'),
      ('pssa-partner-001-sem-001-b', 'sem-001-b')
    )
  ) <> 2 THEN
    RAISE EXCEPTION 'The two approved partner assignments are not the live rows.';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM seminar_session_rosters
    WHERE "eventId" = 'evt-001' AND "seminarId" = 'sem-001-a'
  ) THEN
    RAISE EXCEPTION 'The approved sem-001-a roster row is not present.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM partners p
    CROSS JOIN LATERAL jsonb_array_elements(p."portalSeminarSpeakers") AS entry
    WHERE p.id = 'partner-001'
      AND jsonb_typeof(p."portalSeminarSpeakers") = 'array'
      AND entry->>'seminarId' = 'sem-001-a'
  ) THEN
    RAISE EXCEPTION 'partner-001 portalSeminarSpeakers is not an array containing sem-001-a.';
  END IF;

  SELECT string_agg(a.id, ', ' ORDER BY a.id)
  INTO missing_partner_decisions
  FROM partner_seminar_slot_assignments a
  WHERE a."seminarId" IN (SELECT id FROM legacy_seminar)
    AND a.id NOT IN (SELECT assignment_id FROM partner_assignment_decision);

  IF missing_partner_decisions IS NOT NULL OR EXISTS (
    SELECT 1
    FROM partner_assignment_decision d
    LEFT JOIN partner_seminar_slot_assignments a
      ON a.id = d.assignment_id
     AND a."seminarId" IN (SELECT id FROM legacy_seminar)
    WHERE a.id IS NULL
  ) THEN
    RAISE EXCEPTION
      'Partner assignment mapping is incomplete. Live legacy assignments without a decision: %.',
      COALESCE(missing_partner_decisions, '(decision rows do not match live assignments)');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM partner_assignment_decision d
    LEFT JOIN canonical_schedule c ON c.id = d.canonical_seminar_id
    WHERE d.action = 'MIGRATE_TO_CANONICAL'
      AND c.id IS NULL
  ) THEN
    RAISE EXCEPTION 'A partner MIGRATE_TO_CANONICAL target is not one of sem-2026-01..14.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM partner_assignment_decision d
    JOIN partner_seminar_slot_assignments source ON source.id = d.assignment_id
    JOIN partner_seminar_slot_assignments existing
      ON existing."partnershipId" = source."partnershipId"
     AND existing."seminarId" = d.canonical_seminar_id
    WHERE d.action = 'MIGRATE_TO_CANONICAL'
  ) THEN
    RAISE EXCEPTION 'Partner migration would duplicate a partnership seminar assignment.';
  END IF;

  SELECT string_agg(roster."eventId" || ':' || roster."seminarId", ', ' ORDER BY roster."seminarId")
  INTO missing_roster_decisions
  FROM seminar_session_rosters roster
  WHERE roster."seminarId" IN (SELECT id FROM legacy_seminar)
    AND NOT EXISTS (
      SELECT 1
      FROM roster_decision d
      WHERE d.event_id = roster."eventId"
        AND d.legacy_seminar_id = roster."seminarId"
    );

  IF missing_roster_decisions IS NOT NULL OR EXISTS (
    SELECT 1
    FROM roster_decision d
    LEFT JOIN seminar_session_rosters roster
      ON roster."eventId" = d.event_id
     AND roster."seminarId" = d.legacy_seminar_id
    WHERE roster."seminarId" IS NULL
  ) THEN
    RAISE EXCEPTION
      'Roster mapping is incomplete. Live legacy rosters without a decision: %.',
      COALESCE(missing_roster_decisions, '(decision rows do not match live rosters)');
  END IF;

  IF EXISTS (
    SELECT 1
    FROM roster_decision d
    LEFT JOIN canonical_schedule c ON c.id = d.canonical_seminar_id
    WHERE d.action = 'MIGRATE_TO_CANONICAL'
      AND c.id IS NULL
  ) OR EXISTS (
    SELECT 1
    FROM roster_decision d
    JOIN seminar_session_rosters existing
      ON existing."eventId" = d.event_id
     AND existing."seminarId" = d.canonical_seminar_id
    WHERE d.action = 'MIGRATE_TO_CANONICAL'
  ) THEN
    RAISE EXCEPTION 'A roster migration target is missing or already has a roster.';
  END IF;

  SELECT string_agg(p.id, ', ' ORDER BY p.id)
  INTO missing_portal_decisions
  FROM partners p
  WHERE EXISTS (
    SELECT 1
    FROM legacy_seminar legacy
    WHERE p."portalSeminarSpeakers"::text LIKE '%' || legacy.id || '%'
  )
  AND p.id NOT IN (SELECT partner_id FROM portal_speaker_decision);

  IF missing_portal_decisions IS NOT NULL THEN
    RAISE EXCEPTION
      'Portal speaker JSON still cites a legacy seminar id and has no decision: %.',
      missing_portal_decisions;
  END IF;
END $$;

CREATE TEMP TABLE assignment_keep_guard ON COMMIT DROP AS
SELECT
  count(*) AS kept,
  md5(COALESCE(string_agg(
    id || '|' || "partnershipId" || '|' || "seminarId" || '|' || slots::text || '|' || COALESCE("seminarTitle", ''),
    E'\n' ORDER BY id
  ), '')) AS signature
FROM partner_seminar_slot_assignments
WHERE id NOT IN (
  'pssa-partner-001-sem-001-a',
  'pssa-partner-001-sem-001-b'
);

CREATE TEMP TABLE roster_keep_guard ON COMMIT DROP AS
SELECT
  count(*) AS kept,
  md5(COALESCE(string_agg(
    "eventId" || '|' || "seminarId" || '|' || COALESCE(moderator::text, '') || '|' || panelists::text || '|' || COALESCE("topicBrief", '') || '|' || COALESCE(notes, ''),
    E'\n' ORDER BY "eventId", "seminarId"
  ), '')) AS signature
FROM seminar_session_rosters
WHERE NOT ("eventId" = 'evt-001' AND "seminarId" = 'sem-001-a');

CREATE TEMP TABLE partner_unrelated_guard ON COMMIT DROP AS
SELECT
  (
    SELECT md5(COALESCE(string_agg(
      p.id || '|' || (to_jsonb(p) - 'portalSeminarSpeakers')::text,
      E'\n' ORDER BY p.id
    ), ''))
    FROM partners p
  ) AS partner_without_portal_md5,
  (
    SELECT md5(COALESCE(string_agg(
      p.id || '|' || COALESCE(p."portalSeminarSpeakers"::text, ''),
      E'\n' ORDER BY p.id
    ), ''))
    FROM partners p
    WHERE p.id <> 'partner-001'
  ) AS other_portal_md5,
  (SELECT count(*) FROM partners) AS partner_rows,
  (SELECT count(*) FROM partner_seminar_slot_assignments) AS assignment_rows,
  (SELECT count(*) FROM seminar_session_rosters) AS roster_rows;

CREATE TEMP TABLE portal_expected ON COMMIT DROP AS
SELECT COALESCE(
  (
    SELECT jsonb_agg(listed.entry ORDER BY listed.ordinality)
    FROM jsonb_array_elements(p."portalSeminarSpeakers") WITH ORDINALITY AS listed(entry, ordinality)
    WHERE COALESCE(listed.entry->>'seminarId', '') NOT IN (SELECT id FROM legacy_seminar)
  ),
  '[]'::jsonb
) AS speakers
FROM partners p
WHERE p.id = 'partner-001';

DELETE FROM partner_seminar_slot_assignments AS assignment
USING partner_assignment_decision AS decision
WHERE assignment.id = decision.assignment_id
  AND decision.action = 'DELETE_ASSIGNMENT';

DELETE FROM seminar_session_rosters AS roster
USING roster_decision AS decision
WHERE roster."eventId" = decision.event_id
  AND roster."seminarId" = decision.legacy_seminar_id
  AND decision.action = 'DELETE_ROSTER';

UPDATE partners AS partner
SET "portalSeminarSpeakers" = expected.speakers
FROM portal_expected AS expected
WHERE partner.id = 'partner-001';

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM partner_seminar_slot_assignments
    WHERE "seminarId" IN (SELECT id FROM legacy_seminar)
  ) THEN
    RAISE EXCEPTION 'Legacy partner assignments remain. Seminar delete would hit ON DELETE RESTRICT.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM seminar_session_rosters
    WHERE "seminarId" IN (SELECT id FROM legacy_seminar)
  ) THEN
    RAISE EXCEPTION 'Legacy roster rows remain. Refusing to rely on ON DELETE CASCADE.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_seminars
    WHERE "seminarId" IN (SELECT id FROM legacy_seminar)
  ) THEN
    RAISE EXCEPTION 'Legacy registration seminarId values remain.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM partners p
    JOIN portal_speaker_decision d ON d.partner_id = p.id
    WHERE d.action = 'STRIP_LEGACY_SEMINAR_IDS'
      AND EXISTS (
        SELECT 1
        FROM legacy_seminar legacy
        WHERE p."portalSeminarSpeakers"::text LIKE '%' || legacy.id || '%'
      )
  ) THEN
    RAISE EXCEPTION 'Portal speaker JSON still contains a legacy seminar id after strip.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM whatsapp_registration_conversations
    WHERE status::text NOT IN ('COMPLETED', 'CANCELLED')
      AND EXISTS (
        SELECT 1
        FROM retired_seminar retired
        WHERE "selectedSeminarIds" @> to_jsonb(retired.id)
      )
  ) THEN
    RAISE EXCEPTION 'An active or incomplete WhatsApp conversation references a retired seminar id.';
  END IF;
END $$;

DELETE FROM seminars
WHERE id IN (SELECT id FROM legacy_seminar)
  AND "eventId" = 'evt-001';

DO $$
DECLARE
  seminar_count integer;
  canonical_count integer;
BEGIN
  SELECT count(*) INTO seminar_count FROM seminars WHERE "eventId" = 'evt-001';
  SELECT count(*) INTO canonical_count
  FROM seminars s
  JOIN canonical_schedule c ON c.id = s.id AND c.title = s.title
  WHERE s."eventId" = 'evt-001'
    AND s.date IS NULL
    AND s."startTime" IS NULL
    AND s."endTime" IS NULL
    AND s.hall IS NULL
    AND s."panelistSlots" IS NULL;

  IF seminar_count <> 14 OR canonical_count <> 14 THEN
    RAISE EXCEPTION
      'evt-001 final seminar state is not the 14 canonical rows (count %).',
      seminar_count;
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminars WHERE id IN (SELECT id FROM retired_seminar)
  ) THEN
    RAISE EXCEPTION 'A retired seminar id still exists.';
  END IF;

  IF (SELECT count(*) FROM registration_title_snapshot) <> 11
     OR EXISTS (
       SELECT 1
       FROM registration_title_snapshot snap
       JOIN registration_seminars live ON live.id = snap.id
       WHERE live."seminarTitle" IS DISTINCT FROM snap."seminarTitle"
          OR live."seminarId" IS NOT NULL
     ) THEN
    RAISE EXCEPTION 'The 11 historical registration interests were not preserved with a null seminarId.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM partner_seminar_slot_assignments
    WHERE id IN ('pssa-partner-001-sem-001-a', 'pssa-partner-001-sem-001-b')
  ) THEN
    RAISE EXCEPTION 'A retired partner slot assignment still exists.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminar_session_rosters
    WHERE "eventId" = 'evt-001' AND "seminarId" = 'sem-001-a'
  ) THEN
    RAISE EXCEPTION 'The retired sem-001-a roster still exists.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM partners
    WHERE id = 'partner-001'
      AND COALESCE("portalSeminarSpeakers"::text, '') LIKE '%sem-001-a%'
  ) OR EXISTS (
    SELECT 1
    FROM partners p
    JOIN portal_expected expected ON true
    WHERE p.id = 'partner-001'
      AND p."portalSeminarSpeakers" IS DISTINCT FROM expected.speakers
  ) THEN
    RAISE EXCEPTION 'Christ University portalSeminarSpeakers still contains a legacy seminar reference.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM assignment_keep_guard guard
    WHERE guard.kept <> (SELECT count(*) FROM partner_seminar_slot_assignments)
       OR guard.kept <> (SELECT assignment_rows - 2 FROM partner_unrelated_guard)
       OR guard.signature IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(
           id || '|' || "partnershipId" || '|' || "seminarId" || '|' || slots::text || '|' || COALESCE("seminarTitle", ''),
           E'\n' ORDER BY id
         ), ''))
         FROM partner_seminar_slot_assignments
       )
  ) OR EXISTS (
    SELECT 1
    FROM roster_keep_guard guard
    WHERE guard.kept <> (SELECT count(*) FROM seminar_session_rosters)
       OR guard.kept <> (SELECT roster_rows - 1 FROM partner_unrelated_guard)
       OR guard.signature IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(
           "eventId" || '|' || "seminarId" || '|' || COALESCE(moderator::text, '') || '|' || panelists::text || '|' || COALESCE("topicBrief", '') || '|' || COALESCE(notes, ''),
           E'\n' ORDER BY "eventId", "seminarId"
         ), ''))
         FROM seminar_session_rosters
       )
  ) OR EXISTS (
    SELECT 1
    FROM partner_unrelated_guard guard
    WHERE guard.partner_rows <> (SELECT count(*) FROM partners)
       OR guard.partner_without_portal_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(
           p.id || '|' || (to_jsonb(p) - 'portalSeminarSpeakers')::text,
           E'\n' ORDER BY p.id
         ), ''))
         FROM partners p
       )
       OR guard.other_portal_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(
           p.id || '|' || COALESCE(p."portalSeminarSpeakers"::text, ''),
           E'\n' ORDER BY p.id
         ), ''))
         FROM partners p
         WHERE p.id <> 'partner-001'
       )
  ) OR EXISTS (
    SELECT 1
    FROM registration_unrelated_snapshot snap
    JOIN registration_seminars live ON live.id = snap.id
    WHERE live."seminarTitle" IS DISTINCT FROM snap."seminarTitle"
       OR live."seminarId" IS DISTINCT FROM snap."seminarId"
       OR live."registrationId" IS DISTINCT FROM snap."registrationId"
  ) THEN
    RAISE EXCEPTION 'Unrelated partner, roster, or registration data changed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_seminars
    WHERE "seminarId" IN (SELECT id FROM legacy_seminar)
       OR "seminarId" IS NOT NULL AND "seminarId" NOT IN (SELECT id FROM seminars)
  ) THEN
    RAISE EXCEPTION 'A registration seminar reference is missing or still points at a legacy id.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_title_snapshot snap
    JOIN registration_seminars live ON live.id = snap.id
    WHERE live."seminarTitle" IS DISTINCT FROM snap."seminarTitle"
       OR live."seminarId" IS NOT NULL
  ) OR (
    SELECT count(*) FROM registration_title_snapshot
  ) <> (
    SELECT count(*) FROM registration_seminars
    WHERE id IN (SELECT id FROM registration_title_snapshot)
  ) THEN
    RAISE EXCEPTION 'Historical registration interests were not preserved.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM registration_history_guard guard
    WHERE guard.registration_seminar_rows <> (SELECT count(*) FROM registration_seminars)
       OR guard.registration_title_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(id || '|' || "seminarTitle", E'\n' ORDER BY id), ''))
         FROM registration_seminars
       )
       OR guard.attempt_interest_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(id || '|' || "seminarInterests"::text, E'\n' ORDER BY id), ''))
         FROM registration_attempts
       )
       OR guard.whatsapp_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg(id || '|' || "selectedSeminarIds"::text, E'\n' ORDER BY id), ''))
         FROM whatsapp_registration_conversations
       )
  ) THEN
    RAISE EXCEPTION 'Registration titles, attempt interests, or WhatsApp selections changed.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM whatsapp_registration_conversations
    WHERE status::text NOT IN ('COMPLETED', 'CANCELLED')
      AND EXISTS (
        SELECT 1
        FROM retired_seminar retired
        WHERE "selectedSeminarIds" @> to_jsonb(retired.id)
      )
  ) THEN
    RAISE EXCEPTION 'An active or incomplete WhatsApp conversation references a retired seminar id.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM partner_seminar_slot_assignments a
    LEFT JOIN seminars s ON s.id = a."seminarId"
    WHERE s.id IS NULL
       OR a."seminarId" IN (SELECT id FROM legacy_seminar)
  ) OR EXISTS (
    SELECT 1
    FROM seminar_session_rosters roster
    LEFT JOIN seminars s
      ON s.id = roster."seminarId"
     AND s."eventId" = roster."eventId"
    WHERE s.id IS NULL
       OR roster."seminarId" IN (SELECT id FROM legacy_seminar)
  ) THEN
    RAISE EXCEPTION 'An orphan partner assignment or roster reference remains.';
  END IF;
END $$;

COMMIT;
