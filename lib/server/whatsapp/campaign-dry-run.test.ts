import { describe, expect, it } from "vitest";

import {
  isDryRunMetaMessageId,
  dryRunMessageId,
} from "@/lib/server/whatsapp/campaign-dry-run";

describe("campaign dry-run identifiers", () => {
  it("marks dry-run ids so webhooks ignore them", () => {
    const id = dryRunMessageId("recipient-123");
    expect(isDryRunMetaMessageId(id)).toBe(true);
    expect(isDryRunMetaMessageId("wamid.real")).toBe(false);
  });
});