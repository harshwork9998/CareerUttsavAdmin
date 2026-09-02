-- AlterTable
ALTER TABLE "whatsapp_registration_conversations" ADD COLUMN "lastInboundAt" TIMESTAMP(3),
ADD COLUMN "highestReminderStageSent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "lastReminderAttemptAt" TIMESTAMP(3);
