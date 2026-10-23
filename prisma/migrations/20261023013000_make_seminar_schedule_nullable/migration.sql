-- Allow canonical seminar rows to exist before schedule metadata is decided.
-- Not applied to production by this change.
-- Does not rewrite seminar ids, titles, or existing schedule values.

ALTER TABLE "seminars" ALTER COLUMN "date" DROP NOT NULL;
ALTER TABLE "seminars" ALTER COLUMN "startTime" DROP NOT NULL;
ALTER TABLE "seminars" ALTER COLUMN "endTime" DROP NOT NULL;
ALTER TABLE "seminars" ALTER COLUMN "hall" DROP NOT NULL;
ALTER TABLE "seminars" ALTER COLUMN "panelistSlots" DROP NOT NULL;
