import { describe, expect, it } from "vitest";

import type { WhatsAppRegistrationConversation } from "@/lib/generated/prisma/client";
import {
  mapPrismaConversationToState,
  mapStateToPrismaConversationData,
} from "@/lib/server/whatsapp/whatsapp-conversation-map";
import type { WhatsAppConversationState } from "@/lib/server/whatsapp/registration-conversation";
import { processRegistrationConversationTurn } from "@/lib/server/whatsapp/registration-conversation";
import {
  buildTestSeminarDayCatalog,
  buildTestSeminarOptions,
} from "@/lib/server/whatsapp/whatsapp-seminar-test-fixtures";

const finishWaitingState: WhatsAppConversationState = {
  waId: "919876543210",
  status: "ACTIVE",
  currentStep: "AWAITING_SEMINAR_FINISH",
  studentName: "Aarav Sharma",
  email: "aarav@example.com",
  classLabel: "Class 10",
  gender: "Male",
  board: "CBSE",
  interestedStream: "Science",
  college: "National Public School",
  city: "Bangalore",
  selectedSeminarIds: ["sem-001-a", "sem-001-b", "sem-001-c"],
  completedRegistrationId: null,
};

describe("whatsapp conversation step persistence", () => {
  it("persists AWAITING_SEMINAR_FINISH directly without converting to AWAITING_SEMINARS", () => {
    const expiresAt = new Date("2026-09-16T12:00:00.000Z");
    const prismaData = mapStateToPrismaConversationData(
      finishWaitingState,
      expiresAt
    );

    expect(prismaData.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(prismaData.selectedSeminarIds).toEqual([
      "sem-001-a",
      "sem-001-b",
      "sem-001-c",
    ]);
  });

  it("loads AWAITING_SEMINAR_FINISH from the database without translation", () => {
    const expiresAt = new Date("2026-09-16T12:00:00.000Z");
    const record = {
      id: "conv-001",
      ...mapStateToPrismaConversationData(finishWaitingState, expiresAt),
      lastInboundAt: null,
      highestReminderStageSent: 0,
      lastReminderAttemptAt: null,
      createdAt: expiresAt,
      updatedAt: expiresAt,
    } as WhatsAppRegistrationConversation;

    const restored = mapPrismaConversationToState(record);
    expect(restored.currentStep).toBe("AWAITING_SEMINAR_FINISH");
    expect(restored.selectedSeminarIds).toEqual(finishWaitingState.selectedSeminarIds);
  });

  it("does not convert legacy AWAITING_SEMINARS rows with selections into AWAITING_SEMINAR_FINISH on load", () => {
    const expiresAt = new Date("2026-09-16T12:00:00.000Z");
    const legacyRecord = {
      id: "conv-legacy",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_SEMINARS",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-legacy-1", "sem-legacy-2"],
      completedRegistrationId: null,
      expiresAt,
      lastInboundAt: null,
      highestReminderStageSent: 0,
      lastReminderAttemptAt: null,
      createdAt: expiresAt,
      updatedAt: expiresAt,
    } as WhatsAppRegistrationConversation;

    const restored = mapPrismaConversationToState(legacyRecord);
    expect(restored.currentStep).toBe("AWAITING_SEMINARS");
    expect(restored.selectedSeminarIds).toEqual(["sem-legacy-1", "sem-legacy-2"]);
  });

  it("legacy AWAITING_SEMINARS with selections is recovered by conversation logic, not persistence", () => {
    const expiresAt = new Date("2026-09-16T12:00:00.000Z");
    const legacy = mapPrismaConversationToState({
      id: "conv-legacy",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_SEMINARS",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-legacy-1"],
      completedRegistrationId: null,
      expiresAt,
      lastInboundAt: null,
      highestReminderStageSent: 0,
      lastReminderAttemptAt: null,
      createdAt: expiresAt,
      updatedAt: expiresAt,
    } as WhatsAppRegistrationConversation);

    const seminarOptions = buildTestSeminarOptions();
    const seminarDayCatalog = buildTestSeminarDayCatalog(seminarOptions);

    const migrated = processRegistrationConversationTurn({
      conversation: legacy,
      message: { text: "1" },
      seminarOptions,
      seminarDayCatalog,
      waId: legacy.waId,
    });

    expect(migrated.conversation.currentStep).toBe("AWAITING_SEMINARS");
    expect(migrated.conversation.selectedSeminarIds).toEqual([]);
    expect(
      migrated.actions.some(
        (action) =>
          action.type === "TEXT" &&
          action.body.includes("seminar options have been updated")
      )
    ).toBe(true);
  });
});
