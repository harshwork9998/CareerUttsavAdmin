-- Admin user ↔ Relationship Owner (SPOC) mapping
ALTER TABLE "admin_users" ADD COLUMN "relationshipSpocId" TEXT;

CREATE UNIQUE INDEX "admin_users_relationshipSpocId_key" ON "admin_users"("relationshipSpocId");

CREATE INDEX "admin_users_relationshipSpocId_idx" ON "admin_users"("relationshipSpocId");

ALTER TABLE "admin_users" ADD CONSTRAINT "admin_users_relationshipSpocId_fkey" FOREIGN KEY ("relationshipSpocId") REFERENCES "spocs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Daily Relationship Owner follow-up digest audit log
CREATE TYPE "RelationshipOwnerFollowUpDigestStatus" AS ENUM ('PENDING', 'SENT', 'FAILED', 'SKIPPED');

CREATE TABLE "relationship_owner_follow_up_digests" (
    "id" TEXT NOT NULL,
    "ownerSpocId" TEXT NOT NULL,
    "digestDate" TEXT NOT NULL,
    "recipientPhone" TEXT NOT NULL,
    "itemCount" INTEGER NOT NULL,
    "templateName" TEXT NOT NULL,
    "status" "RelationshipOwnerFollowUpDigestStatus" NOT NULL,
    "messageId" TEXT,
    "attemptedAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "errorMessage" TEXT,
    "skipReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "relationship_owner_follow_up_digests_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "relationship_owner_follow_up_digests_ownerSpocId_digestDate_key" ON "relationship_owner_follow_up_digests"("ownerSpocId", "digestDate");

CREATE INDEX "relationship_owner_follow_up_digests_digestDate_idx" ON "relationship_owner_follow_up_digests"("digestDate");

ALTER TABLE "relationship_owner_follow_up_digests" ADD CONSTRAINT "relationship_owner_follow_up_digests_ownerSpocId_fkey" FOREIGN KEY ("ownerSpocId") REFERENCES "spocs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
