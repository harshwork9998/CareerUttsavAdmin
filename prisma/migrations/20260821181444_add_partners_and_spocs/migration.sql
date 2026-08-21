-- CreateTable
CREATE TABLE "spocs" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "organization" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailNormalized" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "spocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partners" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "state" TEXT NOT NULL DEFAULT '',
    "stage" TEXT NOT NULL,
    "primaryContact" JSONB NOT NULL,
    "secondaryContact" JSONB NOT NULL,
    "relationshipOrganization" TEXT NOT NULL DEFAULT '',
    "relationshipManagerName" TEXT NOT NULL DEFAULT '',
    "relationshipManagerPhone" TEXT NOT NULL DEFAULT '',
    "relationshipManagerEmail" TEXT NOT NULL DEFAULT '',
    "relationshipSpocId" TEXT,
    "stageRemarks" JSONB NOT NULL DEFAULT '[]',
    "meetings" JSONB NOT NULL DEFAULT '[]',
    "contactedAt" TEXT,
    "contactedNotes" TEXT,
    "meetingAt" TEXT,
    "meetingNotes" TEXT,
    "notProceedingAt" TEXT,
    "notProceedingReason" TEXT,
    "sponsorshipTier" TEXT,
    "sponsorshipNotes" TEXT,
    "legacyDeliverables" JSONB,
    "deliverablesConfirmedAt" TIMESTAMP(3),
    "seminarSlotsConfirmedAt" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2),
    "discountAmount" DECIMAL(12,2),
    "netAmount" DECIMAL(12,2),
    "commercialsConfirmedAt" TIMESTAMP(3),
    "portalLogin" TEXT,
    "portalLoginNormalized" TEXT,
    "portalInviteEmail" TEXT,
    "portalInviteEmailNormalized" TEXT,
    "portalPasswordHash" TEXT,
    "portalAuthVersion" INTEGER NOT NULL DEFAULT 0,
    "portalPasswordChangedAt" TIMESTAMP(3),
    "portalPasswordPromptSkippedAt" TIMESTAMP(3),
    "portalInviteSentAt" TIMESTAMP(3),
    "portalDocuments" JSONB,
    "portalFasciaName" TEXT,
    "portalWebsiteUrl" TEXT,
    "portalSmsContent" TEXT,
    "portalSeminarSpeakers" JSONB,
    "portalRepresentatives" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_event_links" (
    "partnerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,

    CONSTRAINT "partner_event_links_pkey" PRIMARY KEY ("partnerId","eventId")
);

-- CreateTable
CREATE TABLE "partner_event_partnerships" (
    "id" TEXT NOT NULL,
    "partnerId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "sponsorshipTier" TEXT,
    "customTierLabel" TEXT,
    "deliverables" JSONB NOT NULL DEFAULT '[]',
    "seminarSlotCount" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "partner_event_partnerships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "partner_seminar_slot_assignments" (
    "id" TEXT NOT NULL,
    "partnershipId" TEXT NOT NULL,
    "seminarId" TEXT NOT NULL,
    "slots" INTEGER NOT NULL,
    "seminarTitle" TEXT,

    CONSTRAINT "partner_seminar_slot_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "spocs_emailNormalized_key" ON "spocs"("emailNormalized");

-- CreateIndex
CREATE INDEX "spocs_organization_idx" ON "spocs"("organization");

-- CreateIndex
CREATE UNIQUE INDEX "partners_portalLoginNormalized_key" ON "partners"("portalLoginNormalized");

-- CreateIndex
CREATE UNIQUE INDEX "partners_portalInviteEmailNormalized_key" ON "partners"("portalInviteEmailNormalized");

-- CreateIndex
CREATE INDEX "partners_stage_idx" ON "partners"("stage");

-- CreateIndex
CREATE INDEX "partners_relationshipSpocId_idx" ON "partners"("relationshipSpocId");

-- CreateIndex
CREATE INDEX "partner_event_links_eventId_idx" ON "partner_event_links"("eventId");

-- CreateIndex
CREATE INDEX "partner_event_partnerships_eventId_idx" ON "partner_event_partnerships"("eventId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_event_partnerships_partnerId_eventId_key" ON "partner_event_partnerships"("partnerId", "eventId");

-- CreateIndex
CREATE INDEX "partner_seminar_slot_assignments_seminarId_idx" ON "partner_seminar_slot_assignments"("seminarId");

-- CreateIndex
CREATE UNIQUE INDEX "partner_seminar_slot_assignments_partnershipId_seminarId_key" ON "partner_seminar_slot_assignments"("partnershipId", "seminarId");

-- AddForeignKey
ALTER TABLE "partners" ADD CONSTRAINT "partners_relationshipSpocId_fkey" FOREIGN KEY ("relationshipSpocId") REFERENCES "spocs"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_event_links" ADD CONSTRAINT "partner_event_links_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_event_links" ADD CONSTRAINT "partner_event_links_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_event_partnerships" ADD CONSTRAINT "partner_event_partnerships_partnerId_fkey" FOREIGN KEY ("partnerId") REFERENCES "partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_event_partnerships" ADD CONSTRAINT "partner_event_partnerships_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_seminar_slot_assignments" ADD CONSTRAINT "partner_seminar_slot_assignments_partnershipId_fkey" FOREIGN KEY ("partnershipId") REFERENCES "partner_event_partnerships"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "partner_seminar_slot_assignments" ADD CONSTRAINT "partner_seminar_slot_assignments_seminarId_fkey" FOREIGN KEY ("seminarId") REFERENCES "seminars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
