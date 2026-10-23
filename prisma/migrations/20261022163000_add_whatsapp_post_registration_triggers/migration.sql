-- Additive post-registration growth triggers.
-- Not applied to production by this change.

CREATE TYPE "WhatsAppPostRegistrationTriggerKind" AS ENUM ('INSTAGRAM', 'PARENT_INVITE', 'FRIEND_INVITE');

CREATE TYPE "WhatsAppPostRegistrationTriggerStatus" AS ENUM ('PENDING', 'CLAIMED', 'SENT', 'CANCELLED');

CREATE TABLE "whatsapp_post_registration_triggers" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "kind" "WhatsAppPostRegistrationTriggerKind" NOT NULL,
    "dueAt" TIMESTAMP(3) NOT NULL,
    "status" "WhatsAppPostRegistrationTriggerStatus" NOT NULL DEFAULT 'PENDING',
    "claimedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_post_registration_triggers_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "whatsapp_post_registration_triggers_registrationId_kind_key"
  ON "whatsapp_post_registration_triggers"("registrationId", "kind");

CREATE INDEX "whatsapp_post_registration_triggers_status_dueAt_idx"
  ON "whatsapp_post_registration_triggers"("status", "dueAt");
