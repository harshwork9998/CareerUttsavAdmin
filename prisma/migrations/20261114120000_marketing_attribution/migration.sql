-- Lead attribution snapshots on registrations (simplified static configuration).
-- Replaces the undeployed Phase 1 marketing CRUD tables migration (never applied in production).
-- Forward-only; do not apply to production until reviewed.

ALTER TABLE "registrations"
  ADD COLUMN IF NOT EXISTS "leadSource" TEXT,
  ADD COLUMN IF NOT EXISTS "leadSubSource" TEXT,
  ADD COLUMN IF NOT EXISTS "attributionTrackingCode" TEXT;

CREATE INDEX IF NOT EXISTS "registrations_leadSource_idx" ON "registrations"("leadSource");
CREATE INDEX IF NOT EXISTS "registrations_leadSubSource_idx" ON "registrations"("leadSubSource");

ALTER TABLE "registration_attempts"
  ADD COLUMN IF NOT EXISTS "attributionTrackingCode" TEXT;

ALTER TABLE "whatsapp_registration_conversations"
  ADD COLUMN IF NOT EXISTS "attributionTrackingCode" TEXT,
  ADD COLUMN IF NOT EXISTS "leadSource" TEXT,
  ADD COLUMN IF NOT EXISTS "leadSubSource" TEXT;