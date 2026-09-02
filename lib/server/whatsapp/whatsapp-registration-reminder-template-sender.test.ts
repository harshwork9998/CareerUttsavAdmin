import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendTemplateMock = vi.fn();

vi.mock("@/lib/server/whatsapp/meta-client", () => ({
  sendWhatsAppTemplate: (...args: unknown[]) => sendTemplateMock(...args),
}));

import { sendWhatsAppRegistrationReminder24hTemplate } from "@/lib/server/whatsapp/whatsapp-registration-reminder-template-sender";

describe("whatsapp registration reminder template sender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME =
      "career_uttsav_registration_reminder";
    process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_LANGUAGE = "en_US";
    sendTemplateMock.mockResolvedValue({ success: true, messageId: "wamid.template" });
  });

  afterEach(() => {
    delete process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME;
    delete process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_LANGUAGE;
  });

  it("fails safely when template name is missing", async () => {
    delete process.env.WHATSAPP_REGISTRATION_REMINDER_TEMPLATE_NAME;

    const result = await sendWhatsAppRegistrationReminder24hTemplate("919876543210", {
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_COLLEGE",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
    });

    expect(result).toEqual({
      success: false,
      errorCode: "WHATSAPP_REMINDER_TEMPLATE_NOT_CONFIGURED",
    });
    expect(sendTemplateMock).not.toHaveBeenCalled();
  });

  it("sends the approved template with the student display name parameter", async () => {
    await sendWhatsAppRegistrationReminder24hTemplate("919876543210", {
      waId: "919876543210",
      status: "ACTIVE",
      currentStep: "AWAITING_COLLEGE",
      studentName: "Aarav Sharma",
      email: "aarav@example.com",
      classLabel: "Class 10",
      gender: "Male",
      board: null,
      interestedStream: null,
      college: null,
      city: null,
      selectedSeminarIds: [],
      completedRegistrationId: null,
    });

    expect(sendTemplateMock).toHaveBeenCalledWith({
      to: "919876543210",
      templateName: "career_uttsav_registration_reminder",
      languageCode: "en_US",
      bodyParameters: ["Aarav"],
    });
  });
});
