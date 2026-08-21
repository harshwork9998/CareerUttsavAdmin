import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_ADMIN_UNAVAILABLE_MESSAGE,
  getEventWriteBlockedResponse,
} from "@/lib/server/event-write-guard";

describe("event write guard", () => {
  const original = process.env.REGISTRATION_PERSISTENCE;

  afterEach(() => {
    if (original === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = original;
    }
  });

  it("allows event writes when persistence mode is json", () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    expect(getEventWriteBlockedResponse()).toBeNull();
  });

  it("blocks event writes when persistence mode is prisma", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    const response = getEventWriteBlockedResponse();
    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: EVENT_ADMIN_UNAVAILABLE_MESSAGE,
    });
  });
});
