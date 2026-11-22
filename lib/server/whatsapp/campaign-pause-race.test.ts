import { describe, expect, it } from "vitest";

import {
  isSafeToReturnRecipientToPending,
  recipientMayHaveBeenSubmitted,
} from "@/lib/server/whatsapp/campaign-send-safety";

describe("pause vs send race guards", () => {
  it("does not return to PENDING after submission has started", () => {
    expect(
      isSafeToReturnRecipientToPending({
        submissionStarted: true,
        reason: "campaign_paused",
      })
    ).toBe(false);
    expect(recipientMayHaveBeenSubmitted(new Date())).toBe(true);
  });

  it("allows PENDING only before submission has started", () => {
    expect(
      isSafeToReturnRecipientToPending({
        submissionStarted: false,
        reason: "campaign_paused",
      })
    ).toBe(true);
    expect(
      isSafeToReturnRecipientToPending({
        submissionStarted: false,
        reason: "campaign_not_running",
      })
    ).toBe(true);
  });
});