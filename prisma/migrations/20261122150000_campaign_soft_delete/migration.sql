ALTER TABLE "whatsapp_campaigns"
  ADD COLUMN IF NOT EXISTS "deletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "deletedByAdminId" TEXT;

CREATE INDEX IF NOT EXISTS "whatsapp_campaigns_deletedAt_idx"
  ON "whatsapp_campaigns"("deletedAt");

ALTER TABLE "whatsapp_campaigns"
  ADD CONSTRAINT "whatsapp_campaigns_deletedByAdminId_fkey"
  FOREIGN KEY ("deletedByAdminId") REFERENCES "admin_users"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;