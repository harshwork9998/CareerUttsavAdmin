-- CreateIndex: composite unique on seminars(id, eventId) for roster FK integrity
CREATE UNIQUE INDEX "seminars_id_eventId_key" ON "seminars"("id", "eventId");

-- CreateTable
CREATE TABLE "seminar_session_rosters" (
    "eventId" TEXT NOT NULL,
    "seminarId" TEXT NOT NULL,
    "moderator" JSONB,
    "panelists" JSONB NOT NULL DEFAULT '[]',
    "topicBrief" TEXT,
    "notes" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seminar_session_rosters_pkey" PRIMARY KEY ("eventId","seminarId")
);

-- CreateIndex
CREATE UNIQUE INDEX "seminar_session_rosters_seminarId_eventId_key" ON "seminar_session_rosters"("seminarId", "eventId");

-- CreateIndex
CREATE INDEX "seminar_session_rosters_seminarId_idx" ON "seminar_session_rosters"("seminarId");

-- AddForeignKey
ALTER TABLE "seminar_session_rosters" ADD CONSTRAINT "seminar_session_rosters_eventId_fkey" FOREIGN KEY ("eventId") REFERENCES "events"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seminar_session_rosters" ADD CONSTRAINT "seminar_session_rosters_seminarId_eventId_fkey" FOREIGN KEY ("seminarId", "eventId") REFERENCES "seminars"("id", "eventId") ON DELETE CASCADE ON UPDATE CASCADE;
