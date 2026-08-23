-- CreateEnum
CREATE TYPE "WhatsAppConversationStatus" AS ENUM ('ACTIVE', 'READY_TO_REGISTER', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "WhatsAppConversationStep" AS ENUM ('AWAITING_START', 'AWAITING_NAME', 'AWAITING_EMAIL', 'AWAITING_CLASS', 'AWAITING_GENDER', 'AWAITING_BOARD', 'AWAITING_STREAM', 'AWAITING_COLLEGE', 'AWAITING_CITY', 'AWAITING_SEMINARS', 'READY_TO_REGISTER', 'COMPLETED', 'CANCELLED');

-- CreateTable
CREATE TABLE "whatsapp_registration_conversations" (
    "id" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "status" "WhatsAppConversationStatus" NOT NULL DEFAULT 'ACTIVE',
    "currentStep" "WhatsAppConversationStep" NOT NULL DEFAULT 'AWAITING_START',
    "studentName" TEXT,
    "email" TEXT,
    "classLabel" TEXT,
    "gender" "Gender",
    "board" TEXT,
    "interestedStream" TEXT,
    "college" TEXT,
    "city" TEXT,
    "selectedSeminarIds" JSONB NOT NULL DEFAULT '[]',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "whatsapp_registration_conversations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "whatsapp_inbound_messages" (
    "id" TEXT NOT NULL,
    "messageId" TEXT NOT NULL,
    "waId" TEXT NOT NULL,
    "messageType" TEXT NOT NULL,
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "whatsapp_inbound_messages_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_registration_conversations_waId_key" ON "whatsapp_registration_conversations"("waId");

-- CreateIndex
CREATE INDEX "whatsapp_registration_conversations_status_idx" ON "whatsapp_registration_conversations"("status");

-- CreateIndex
CREATE INDEX "whatsapp_registration_conversations_expiresAt_idx" ON "whatsapp_registration_conversations"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX "whatsapp_inbound_messages_messageId_key" ON "whatsapp_inbound_messages"("messageId");

-- CreateIndex
CREATE INDEX "whatsapp_inbound_messages_waId_idx" ON "whatsapp_inbound_messages"("waId");
