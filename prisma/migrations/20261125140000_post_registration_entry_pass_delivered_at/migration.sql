-- Durable evidence that Meta accepted the registration entry-pass QR (for safe growth recovery).
-- Not applied to production by this change.

ALTER TABLE "whatsapp_registration_conversations"
ADD COLUMN "postRegistrationEntryPassDeliveredAt" TIMESTAMP(3);

CREATE INDEX "whatsapp_registration_conversations_postRegistrationEntryPassDel_idx"
ON "whatsapp_registration_conversations"("postRegistrationEntryPassDeliveredAt");