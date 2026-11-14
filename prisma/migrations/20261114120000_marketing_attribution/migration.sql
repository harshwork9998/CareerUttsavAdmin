-- Marketing attribution configuration (Phase 1 — admin only).
-- Forward-only migration; not applied to production by this change.

CREATE TYPE "MarketingAttributionAuditAction" AS ENUM ('CREATE', 'UPDATE', 'DEACTIVATE', 'ACTIVATE');

CREATE TYPE "MarketingAttributionEntityType" AS ENUM ('LEAD_SOURCE', 'LEAD_SUB_SOURCE', 'MARKETING_CAMPAIGN');

CREATE TABLE "lead_sources" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "description" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lead_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "lead_sub_sources" (
  "id" TEXT NOT NULL,
  "leadSourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "nameKey" TEXT NOT NULL,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "lead_sub_sources_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_campaigns" (
  "id" TEXT NOT NULL,
  "leadSubSourceId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "trackingCode" TEXT NOT NULL,
  "trackingCodeKey" TEXT NOT NULL,
  "placementDescription" TEXT,
  "startDate" TIMESTAMP(3),
  "endDate" TIMESTAMP(3),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "marketing_campaigns_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "marketing_attribution_audit_logs" (
  "id" TEXT NOT NULL,
  "adminUserId" TEXT NOT NULL,
  "action" "MarketingAttributionAuditAction" NOT NULL,
  "entityType" "MarketingAttributionEntityType" NOT NULL,
  "entityId" TEXT NOT NULL,
  "summary" TEXT NOT NULL,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "marketing_attribution_audit_logs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "lead_sources_nameKey_key" ON "lead_sources"("nameKey");
CREATE INDEX "lead_sources_isActive_idx" ON "lead_sources"("isActive");

CREATE UNIQUE INDEX "lead_sub_sources_leadSourceId_nameKey_key" ON "lead_sub_sources"("leadSourceId", "nameKey");
CREATE INDEX "lead_sub_sources_leadSourceId_idx" ON "lead_sub_sources"("leadSourceId");
CREATE INDEX "lead_sub_sources_leadSourceId_isActive_idx" ON "lead_sub_sources"("leadSourceId", "isActive");

CREATE UNIQUE INDEX "marketing_campaigns_trackingCodeKey_key" ON "marketing_campaigns"("trackingCodeKey");
CREATE INDEX "marketing_campaigns_leadSubSourceId_idx" ON "marketing_campaigns"("leadSubSourceId");
CREATE INDEX "marketing_campaigns_leadSubSourceId_isActive_idx" ON "marketing_campaigns"("leadSubSourceId", "isActive");
CREATE INDEX "marketing_campaigns_trackingCode_idx" ON "marketing_campaigns"("trackingCode");

CREATE INDEX "marketing_attribution_audit_logs_entityType_entityId_idx" ON "marketing_attribution_audit_logs"("entityType", "entityId");
CREATE INDEX "marketing_attribution_audit_logs_adminUserId_createdAt_idx" ON "marketing_attribution_audit_logs"("adminUserId", "createdAt");

ALTER TABLE "lead_sub_sources" ADD CONSTRAINT "lead_sub_sources_leadSourceId_fkey" FOREIGN KEY ("leadSourceId") REFERENCES "lead_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "marketing_campaigns" ADD CONSTRAINT "marketing_campaigns_leadSubSourceId_fkey" FOREIGN KEY ("leadSubSourceId") REFERENCES "lead_sub_sources"("id") ON DELETE RESTRICT ON UPDATE CASCADE;