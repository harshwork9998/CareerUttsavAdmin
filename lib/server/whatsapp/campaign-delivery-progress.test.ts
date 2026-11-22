import { describe, expect, it } from "vitest";

import { shouldApplyDeliveryProgress } from "@/lib/server/whatsapp/campaign-delivery-webhook";

describe("delivery webhook progress", () => {
  it("does not downgrade delivered statuses", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "READ", nextStatus: "DELIVERED" })
    ).toBe(false);
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "DELIVERED", nextStatus: "SENT" })
    ).toBe(false);
  });

  it("is idempotent for duplicate events", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "DELIVERED", nextStatus: "DELIVERED" })
    ).toBe(false);
  });

  it("counts read as forward progress from delivered", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "DELIVERED", nextStatus: "READ" })
    ).toBe(true);
  });

  it("does not mark read messages as failed", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "READ", nextStatus: "FAILED" })
    ).toBe(false);
  });

  it("allows late delivery webhooks to upgrade UNKNOWN", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "UNKNOWN", nextStatus: "DELIVERED" })
    ).toBe(true);
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "UNKNOWN", nextStatus: "READ" })
    ).toBe(true);
  });

  it("ignores delivery webhooks for simulated dry-run rows", () => {
    expect(
      shouldApplyDeliveryProgress({ currentStatus: "SIMULATED", nextStatus: "DELIVERED" })
    ).toBe(false);
  });
});