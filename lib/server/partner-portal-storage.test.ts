import { describe, expect, it } from "vitest";

import {
  normalizePortalStorageErrorMessage,
  tusResumableEndpoint,
} from "@/lib/server/partner-portal-storage";

describe("signed advertisement storage", () => {
  it("targets the signed resumable endpoint, not the session endpoint", () => {
    expect(tusResumableEndpoint("example-ref")).toBe(
      "https://example-ref.storage.supabase.co/storage/v1/upload/resumable/sign"
    );
    expect(tusResumableEndpoint("example-ref")).not.toMatch(/resumable$/);
  });

  it("maps an empty Storage failure to the reported generic message", () => {
    expect(normalizePortalStorageErrorMessage("")).toBe(
      "Upload could not be completed. Please try again."
    );
    expect(normalizePortalStorageErrorMessage("Bucket not found")).toBe(
      "Upload could not be completed. Please try again."
    );
  });

  it("keeps size and expiry messages specific", () => {
    expect(normalizePortalStorageErrorMessage("Payload too large")).toMatch(
      /storage upload limit/
    );
    expect(normalizePortalStorageErrorMessage("Invalid signature")).toMatch(
      /session expired/
    );
  });
});
