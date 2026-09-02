import { beforeEach, describe, expect, it, vi } from "vitest";

import { WHATSAPP_CONVERSATION_TTL_MS } from "@/lib/server/whatsapp/registration-conversation";
import { mapPrismaConversationToState } from "@/lib/server/whatsapp/whatsapp-conversation-map";

const findUniqueMock = vi.fn();
const upsertMock = vi.fn();
const deleteMock = vi.fn();
const updateManyMock = vi.fn();

vi.mock("@/lib/server/prisma", () => ({
  prisma: {
    whatsAppRegistrationConversation: {
      findUnique: (...args: unknown[]) => findUniqueMock(...args),
      upsert: (...args: unknown[]) => upsertMock(...args),
      delete: (...args: unknown[]) => deleteMock(...args),
      updateMany: (...args: unknown[]) => updateManyMock(...args),
    },
  },
}));

import {
  deleteExpiredWhatsAppConversation,
  loadWhatsAppConversationForWaId,
  resetWhatsAppConversationsForDeletedRegistration,
} from "@/lib/server/whatsapp/whatsapp-conversation-store";

describe("whatsapp conversation store expiry", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("treats expired ACTIVE conversations as absent", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
      email: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
      createdAt: new Date(Date.now() - WHATSAPP_CONVERSATION_TTL_MS - 1000),
      updatedAt: new Date(Date.now() - WHATSAPP_CONVERSATION_TTL_MS - 1000),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await loadWhatsAppConversationForWaId("919876543210");
    expect(result).toBeNull();
  });

  it("deletes expired conversations lazily", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
      email: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() - 60_000),
    });
    deleteMock.mockResolvedValue({ id: "conv-1" });

    const deleted = await deleteExpiredWhatsAppConversation("919876543210");
    expect(deleted).toBe(true);
    expect(deleteMock).toHaveBeenCalledWith({ where: { waId: "919876543210" } });
  });

  it("loads non-expired READY_TO_REGISTER conversations", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "READY_TO_REGISTER",
      currentStep: "READY_TO_REGISTER",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS),
    });

    const result = await loadWhatsAppConversationForWaId("919876543210");
    expect(result?.status).toBe("READY_TO_REGISTER");
  });

  it("treats expired READY_TO_REGISTER conversations as absent", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "READY_TO_REGISTER",
      currentStep: "READY_TO_REGISTER",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() - 60_000),
    });

    const result = await loadWhatsAppConversationForWaId("919876543210");
    expect(result).toBeNull();
  });

  it("loads ACTIVE conversations before 7 days", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_EMAIL",
      studentName: "Aarav Sharma",
      email: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS),
    });

    const result = await loadWhatsAppConversationForWaId("919876543210");
    expect(result?.status).toBe("ACTIVE");
  });

  it("loads COMPLETED conversations even when expiresAt is in the past", async () => {
    findUniqueMock.mockResolvedValue({
      id: "conv-1",
      waId: "919876543210",
      status: "COMPLETED",
      currentStep: "COMPLETED",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: "CBSE",
      interestedStream: "Science",
      college: "National Public School",
      city: "Bangalore",
      selectedSeminarIds: ["sem-001"],
      completedRegistrationId: "reg-001",
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() - WHATSAPP_CONVERSATION_TTL_MS - 1000),
    });

    const result = await loadWhatsAppConversationForWaId("919876543210");
    expect(result?.status).toBe("COMPLETED");
  });

  it("maps prisma records without parentPhone", () => {
    const state = mapPrismaConversationToState({
      id: "conv-1",
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_NAME",
      studentName: null,
      email: null,
      classLabel: null,
      gender: null,
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      expiresAt: new Date(Date.now() + WHATSAPP_CONVERSATION_TTL_MS),
    });
    expect("parentPhone" in state).toBe(false);
  });

  it("clears linked WhatsApp conversations when a registration is deleted", async () => {
    updateManyMock.mockResolvedValue({ count: 1 });

    const count = await resetWhatsAppConversationsForDeletedRegistration("reg-001");

    expect(count).toBe(1);
    expect(updateManyMock).toHaveBeenCalledWith({
      where: { completedRegistrationId: "reg-001" },
      data: expect.objectContaining({
        status: "CANCELLED",
        currentStep: "CANCELLED",
        completedRegistrationId: null,
        studentName: null,
        email: null,
        selectedSeminarIds: [],
      }),
    });
  });
});
