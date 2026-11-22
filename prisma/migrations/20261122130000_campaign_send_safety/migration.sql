ALTER TYPE "WhatsAppCampaignRecipientStatus" ADD VALUE IF NOT EXISTS 'NEEDS_REVIEW';

ALTER TABLE "whatsapp_campaign_recipients"
  ADD COLUMN IF NOT EXISTS "submissionStartedAt" TIMESTAMP(3);