-- Partner communication history and the event-scoped portal activity clock.
-- This migration only adds storage. It does not send email.

ALTER TABLE "partner_event_partnerships"
ADD COLUMN "partnerPortalLastActivityAt" TIMESTAMP(3);

CREATE TABLE "partner_communication_logs" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "eventPartnershipId" TEXT,
    "eventId" TEXT,
    "communicationType" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL,
    "outcome" TEXT NOT NULL,
    "recipientEmail" TEXT NOT NULL DEFAULT '',
    "messageId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "partner_communication_logs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "partner_communication_logs_partnerId_communicationType_idx"
ON "partner_communication_logs"("partnerId", "communicationType");

CREATE INDEX "partner_communication_logs_partnerId_eventId_sentAt_idx"
ON "partner_communication_logs"("partnerId", "eventId", "sentAt");

ALTER TABLE "partner_communication_logs"
ADD CONSTRAINT "partner_communication_logs_partnerId_fkey"
FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
