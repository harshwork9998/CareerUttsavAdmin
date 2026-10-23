-- Partner portal access flag and database-backed password reset tokens.
-- portalAccessEnabled defaults to false for new rows. Existing rows are backfilled below.

ALTER TABLE "partners" ADD COLUMN "portalAccessEnabled" BOOLEAN NOT NULL DEFAULT false;

-- Identity: authentication uses portalLoginNormalized only.
-- When a partner has no login yet, copy the invite email if it does not collide
-- with another partner's login. Invite emails are preserved either way.
-- When login and invite email differ, login stays the only sign-in identity.
UPDATE "partners" AS p
SET
  "portalLogin" = p."portalInviteEmail",
  "portalLoginNormalized" = p."portalInviteEmailNormalized"
WHERE p."portalLoginNormalized" IS NULL
  AND p."portalInviteEmailNormalized" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1
    FROM "partners" AS other
    WHERE other."id" <> p."id"
      AND other."portalLoginNormalized" = p."portalInviteEmailNormalized"
  );

-- Do not lock out partners who already had portal access.
-- Enabled when an invite was recorded, or a login and a scrypt password hash both exist.
-- "Not Proceeding" and other stages are not used.
UPDATE "partners"
SET "portalAccessEnabled" = true
WHERE "portalInviteSentAt" IS NOT NULL
   OR (
     "portalLoginNormalized" IS NOT NULL
     AND "portalPasswordHash" IS NOT NULL
     AND "portalPasswordHash" LIKE 'scrypt$%'
   );

CREATE TABLE "partner_password_reset_tokens" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),

    CONSTRAINT "partner_password_reset_tokens_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "partner_password_reset_tokens_tokenHash_key" ON "partner_password_reset_tokens"("tokenHash");
CREATE INDEX "partner_password_reset_tokens_partnerId_idx" ON "partner_password_reset_tokens"("partnerId");
CREATE INDEX "partner_password_reset_tokens_expiresAt_idx" ON "partner_password_reset_tokens"("expiresAt");

ALTER TABLE "partner_password_reset_tokens" ADD CONSTRAINT "partner_password_reset_tokens_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;
