-- evt-001 canonical seminar insert.
-- Prepared only. Do not execute until the nullable-schedule migration is applied.
--
-- Inserts the 14 canonical identities with schedule fields NULL.
-- It does not update, rename, or delete the five legacy seminars.
-- It does not touch registrations, partner assignments, rosters, or WhatsApp.

BEGIN;

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

DO $$
BEGIN
  IF (SELECT count(*) FROM canonical_schedule) <> 14 THEN
    RAISE EXCEPTION 'Expected 14 canonical rows in canonical_schedule.';
  END IF;

  IF EXISTS (SELECT 1 FROM events WHERE id = 'evt-001') IS NOT TRUE THEN
    RAISE EXCEPTION 'evt-001 does not exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminars s
    JOIN canonical_schedule c ON c.id = s.id
  ) THEN
    RAISE EXCEPTION 'One or more intended seminar IDs already exist.';
  END IF;

  IF EXISTS (
    SELECT 1 FROM seminars s
    JOIN canonical_schedule c ON c.title = s.title
  ) THEN
    RAISE EXCEPTION 'One or more intended seminar titles already exist.';
  END IF;

  IF (
    SELECT count(*) FROM seminars WHERE "eventId" = 'evt-001'
  ) <> 5 THEN
    RAISE EXCEPTION 'evt-001 seminar count is not 5. Aborting.';
  END IF;

  IF (
    SELECT count(*) FROM (
      SELECT id, title, date, "startTime", "endTime", hall, "panelistSlots"
      FROM seminars
      WHERE id IN ('sem-001-a', 'sem-001-b', 'sem-001-c', 'sem-001-d', 'zyhwu550q')
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
    RAISE EXCEPTION 'A legacy seminar row does not match the preserved snapshot. Aborting.';
  END IF;
END $$;

CREATE TEMP TABLE reference_snapshot ON COMMIT DROP AS
SELECT
  (SELECT count(*) FROM registration_seminars) AS registration_seminars,
  (SELECT count(*) FROM partner_seminar_slot_assignments) AS partner_assignments,
  (SELECT COALESCE(sum(slots), 0) FROM partner_seminar_slot_assignments) AS partner_slots,
  (SELECT count(*) FROM seminar_session_rosters) AS rosters,
  (SELECT md5(COALESCE(string_agg("selectedSeminarIds"::text, '|' ORDER BY id), ''))
     FROM whatsapp_registration_conversations) AS whatsapp_selected_ids_md5;

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

DO $$
DECLARE
  seminar_count integer;
  canonical_count integer;
  distinct_titles integer;
  distinct_ids integer;
  wrong_event integer;
BEGIN
  SELECT count(*) INTO seminar_count FROM seminars WHERE "eventId" = 'evt-001';
  SELECT count(*) INTO canonical_count
  FROM seminars s
  JOIN canonical_schedule c ON c.id = s.id AND c.title = s.title
  WHERE s."eventId" = 'evt-001';
  SELECT count(DISTINCT title) INTO distinct_titles FROM seminars WHERE "eventId" = 'evt-001';
  SELECT count(DISTINCT id) INTO distinct_ids FROM seminars WHERE "eventId" = 'evt-001';
  SELECT count(*) INTO wrong_event
  FROM seminars s
  JOIN canonical_schedule c ON c.id = s.id
  WHERE s."eventId" <> 'evt-001';

  IF seminar_count <> 19 THEN
    RAISE EXCEPTION 'evt-001 seminar count is %, expected 19.', seminar_count;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM seminars s
    JOIN canonical_schedule c ON c.id = s.id
    WHERE s.date IS NOT NULL
       OR s."startTime" IS NOT NULL
       OR s."endTime" IS NOT NULL
       OR s.hall IS NOT NULL
       OR s."panelistSlots" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Canonical seminar schedule fields must stay null on insert.';
  END IF;
  IF canonical_count <> 14 OR distinct_titles <> 19 OR distinct_ids <> 19 OR wrong_event <> 0 THEN
    RAISE EXCEPTION 'Canonical insert verification failed.';
  END IF;

  IF (
    SELECT count(*) FROM (
      SELECT id, title, date, "startTime", "endTime", hall, "panelistSlots"
      FROM seminars
      WHERE id IN ('sem-001-a', 'sem-001-b', 'sem-001-c', 'sem-001-d', 'zyhwu550q')
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
    RAISE EXCEPTION 'Legacy rows changed during insert.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM reference_snapshot
    WHERE registration_seminars <> (SELECT count(*) FROM registration_seminars)
       OR partner_assignments <> (SELECT count(*) FROM partner_seminar_slot_assignments)
       OR partner_slots <> (SELECT COALESCE(sum(slots), 0) FROM partner_seminar_slot_assignments)
       OR rosters <> (SELECT count(*) FROM seminar_session_rosters)
       OR whatsapp_selected_ids_md5 IS DISTINCT FROM (
         SELECT md5(COALESCE(string_agg("selectedSeminarIds"::text, '|' ORDER BY id), ''))
         FROM whatsapp_registration_conversations
       )
  ) THEN
    RAISE EXCEPTION 'A registration, partner, roster, or WhatsApp reference changed.';
  END IF;
END $$;

-- Review the SELECT results before committing.
SELECT id, title, date, "startTime", "endTime", hall, "panelistSlots"
FROM seminars
WHERE "eventId" = 'evt-001'
ORDER BY date, "startTime", id;

COMMIT;
