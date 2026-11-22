import { describe, expect, it } from "vitest";

import {
  classifyMetaSendFailure,
  isSafeToReturnRecipientToPending,
} from "@/lib/server/whatsapp/campaign-send-safety";

describe("campaign send safety", () => {
  it("never returns to PENDING after submission started", () => {
    expect(
      isSafeToReturnRecipientToPending({
        submissionStarted: true,
        reason: "campaign_not_running",
      })
    ).toBe(false);
    expect(
      isSafeToReturnRecipientToPending({
        submissionStarted: false,
        reason: "campaign_not_running",
      })
    ).toBe(true);
  });

  it("treats network timeouts as needs review not blind retry", () => {
    const outcome = classifyMetaSendFailure({
      success: false,
      errorCode: "META_REQUEST_TIMEOUT",
      retryable: true,
    });
    expect(outcome.outcome).toBe("needs_review");
  });

  it("treats Meta throughput limits as failed without retry", () => {
    const outcome = classifyMetaSendFailure({
      success: false,
      errorCode: "META_CLIENT_ERROR",
      retryable: false,
      metaErrorCode: 130429,
    });
    expect(outcome.outcome).toBe("failed");
    expect(outcome.errorCode).toBe("meta_messaging_limit");
  });
});