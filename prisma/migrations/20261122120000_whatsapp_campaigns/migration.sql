CREATE TYPE "WhatsAppCampaignStatus" AS ENUM ('DRAFT', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED');

CREATE TYPE "WhatsAppCampaignRecipientStatus" AS ENUM (
  'INVALID',
  'DUPLICATE',
  'OPTED_OUT',
  'SKIPPED',
  'PENDING',
  'CLAIMED',
  'ACCEPTED',
  'SENT',
  'DELIVERED',
  'READ',
  'FAILED',
  'UNKNOWN',
  'NEEDS_REVIEW',
  'SIMULATED'
);

CREATE TABLE "whatsapp_campaigns" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" "WhatsAppCampaignStatus" NOT NULL DEFAULT 'DRAFT',
    "templateName" TEXT,
    "templateLanguage" TEXT,
    "templateSnapshot" JSONB,
    "variableMapping" JSONB,
    "consentConfirmedAt" TIMESTAMP(3),
    "consentConfirmedBy" TEXT,
    "createdByAdminId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "pausedAt" TIMESTAMP(3),
    "sendDelayMs" INTEGER NOT NULL DEFAULT 400,
    "batchSize" INTEGER NOT NULL DEFAULT 25,
    "testRecipientWaId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_campaign_recipients" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "phoneLast10" TEXT NOT NULL,
    "rowNumber" INTEGER,
    "rowData" JSONB,
    "status" "WhatsAppCampaignRecipientStatus" NOT NULL DEFAULT 'PENDING',
    "metaMessageId" TEXT,
    "attemptCount" INTEGER NOT NULL DEFAULT 0,
    "claimedAt" TIMESTAMP(3),
    "submissionStartedAt" TIMESTAMP(3),
    "acceptedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "skipReason" TEXT,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_campaign_recipients_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "whatsapp_suppressions" (
    "id" TEXT NOT NULL,
    "phoneLast10" TEXT NOT NULL,
    "waId" TEXT,
    "reason" TEXT NOT NULL,
    "source" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_suppressions_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "whatsapp_campaigns_status_idx" ON "whatsapp_campaigns"("status");
CREATE INDEX "whatsapp_campaigns_createdAt_idx" ON "whatsapp_campaigns"("createdAt");

CREATE UNIQUE INDEX "whatsapp_campaign_recipients_campaignId_waId_key" ON "whatsapp_campaign_recipients"("campaignId", "waId");
CREATE UNIQUE INDEX "whatsapp_campaign_recipients_metaMessageId_key" ON "whatsapp_campaign_recipients"("metaMessageId");
CREATE INDEX "whatsapp_campaign_recipients_campaignId_status_idx" ON "whatsapp_campaign_recipients"("campaignId", "status");
CREATE INDEX "whatsapp_campaign_recipients_waId_idx" ON "whatsapp_campaign_recipients"("waId");

CREATE UNIQUE INDEX "whatsapp_suppressions_phoneLast10_key" ON "whatsapp_suppressions"("phoneLast10");
CREATE INDEX "whatsapp_suppressions_waId_idx" ON "whatsapp_suppressions"("waId");

ALTER TABLE "whatsapp_campaigns" ADD CONSTRAINT "whatsapp_campaigns_createdByAdminId_fkey" FOREIGN KEY ("createdByAdminId") REFERENCES "admin_users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "whatsapp_campaign_recipients" ADD CONSTRAINT "whatsapp_campaign_recipients_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "whatsapp_campaigns"("id") ON DELETE CASCADE ON UPDATE CASCADE;