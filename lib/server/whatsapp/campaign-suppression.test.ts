import { describe, expect, it } from "vitest";

import { isWhatsAppOptOutMessage } from "@/lib/server/whatsapp/campaign-suppression";

describe("whatsapp opt-out detection", () => {
  it("recognises stop and unsubscribe messages", () => {
    expect(isWhatsAppOptOutMessage("STOP")).toBe(true);
    expect(isWhatsAppOptOutMessage("unsubscribe")).toBe(true);
    expect(isWhatsAppOptOutMessage("opt out")).toBe(true);
    expect(isWhatsAppOptOutMessage("hello")).toBe(false);
  });
});