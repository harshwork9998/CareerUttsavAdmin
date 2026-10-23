-- Additive registration source and partial-registration attempts.
-- Not applied to production by this change.

CREATE TYPE "RegistrationSource" AS ENUM ('WHATSAPP', 'WEBSITE', 'DIRECT_ENTRY', 'UNKNOWN');

ALTER TABLE "registrations"
  ADD COLUMN "source" "RegistrationSource" NOT NULL DEFAULT 'UNKNOWN';

CREATE TYPE "RegistrationAttemptSource" AS ENUM ('WHATSAPP', 'WEBSITE');

CREATE TYPE "RegistrationAttemptStatus" AS ENUM ('IN_PROGRESS', 'COMPLETED', 'ABANDONED');

CREATE TYPE "RegistrationAttemptStep" AS ENUM (
  'WELCOME',
  'STARTED',
  'NAME',
  'EMAIL',
  'CLASS',
  'GENDER',
  'BOARD',
  'STREAM',
  'SCHOOL_COLLEGE',
  'CITY',
  'SEMINAR_SELECTION',
  'FINISH_REGISTRATION',
  'YOU',
  'ACADEMICS',
  'INTERESTS'
);

CREATE TABLE "registration_attempts" (
  "id" TEXT NOT NULL,
  "eventId" TEXT NOT NULL,
  "source" "RegistrationAttemptSource" NOT NULL,
  "status" "RegistrationAttemptStatus" NOT NULL,
  "phone" TEXT NOT NULL,
  "phoneLast10" TEXT,
  "email" TEXT,
  "emailNormalized" TEXT,
  "name" TEXT,
  "classLabel" TEXT,
  "gender" "Gender",
  "board" TEXT,
  "interestedStream" TEXT,
  "college" TEXT,
  "city" TEXT,
  "seminarInterests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "lastStep" "RegistrationAttemptStep" NOT NULL,
  "startedAt" TIMESTAMP(3) NOT NULL,
  "lastActivityAt" TIMESTAMP(3) NOT NULL,
  "completedAt" TIMESTAMP(3),
  "completedRegistrationId" TEXT,
  "whatsappWaId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "registration_attempts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "registration_attempts_eventId_status_idx"
  ON "registration_attempts"("eventId", "status");

CREATE INDEX "registration_attempts_eventId_source_phoneLast10_idx"
  ON "registration_attempts"("eventId", "source", "phoneLast10");

CREATE INDEX "registration_attempts_emailNormalized_idx"
  ON "registration_attempts"("emailNormalized");

CREATE INDEX "registration_attempts_whatsappWaId_idx"
  ON "registration_attempts"("whatsappWaId");

CREATE INDEX "registration_attempts_completedRegistrationId_idx"
  ON "registration_attempts"("completedRegistrationId");

-- One open attempt per channel and phone. Abandoned and completed history stays.
CREATE UNIQUE INDEX "registration_attempts_one_in_progress_phone_key"
  ON "registration_attempts"("eventId", "source", "phoneLast10")
  WHERE "status" = 'IN_PROGRESS' AND "phoneLast10" IS NOT NULL;

CREATE UNIQUE INDEX "registration_attempts_one_in_progress_wa_key"
  ON "registration_attempts"("eventId", "whatsappWaId")
  WHERE "status" = 'IN_PROGRESS' AND "whatsappWaId" IS NOT NULL;

ALTER TABLE "registration_attempts"
  ADD CONSTRAINT "registration_attempts_eventId_fkey"
  FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "registration_attempts"
  ADD CONSTRAINT "registration_attempts_completedRegistrationId_fkey"
  FOREIGN KEY ("completedRegistrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "whatsapp_registration_conversations"
  ADD COLUMN "registrationAttemptId" TEXT;

CREATE UNIQUE INDEX "whatsapp_registration_conversations_registrationAttemptId_key"
  ON "whatsapp_registration_conversations"("registrationAttemptId");

ALTER TABLE "whatsapp_registration_conversations"
  ADD CONSTRAINT "whatsapp_registration_conversations_registrationAttemptId_fkey"
  FOREIGN KEY ("registrationAttemptId") REFERENCES "registration_attempts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
