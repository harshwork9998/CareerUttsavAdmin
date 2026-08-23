-- AlterTable
ALTER TABLE "whatsapp_registration_conversations" ADD COLUMN "completedRegistrationId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_registration_conversations_completedRegistrationId_key" ON "whatsapp_registration_conversations"("completedRegistrationId");

-- AddForeignKey
ALTER TABLE "whatsapp_registration_conversations" ADD CONSTRAINT "whatsapp_registration_conversations_completedRegistrationId_fkey" FOREIGN KEY ("completedRegistrationId") REFERENCES "registrations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
