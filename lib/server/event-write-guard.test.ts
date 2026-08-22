import { afterEach, describe, expect, it } from "vitest";

import {
  EVENT_ADMIN_UNAVAILABLE_MESSAGE,
  getEventWriteBlockedResponse,
} from "@/lib/server/event-write-guard";

describe("event write guard", () => {
  const originalRegistration = process.env.REGISTRATION_PERSISTENCE;
  const originalEventWrite = process.env.EVENT_WRITE_PERSISTENCE;

  afterEach(() => {
    if (originalRegistration === undefined) {
      delete process.env.REGISTRATION_PERSISTENCE;
    } else {
      process.env.REGISTRATION_PERSISTENCE = originalRegistration;
    }
    if (originalEventWrite === undefined) {
      delete process.env.EVENT_WRITE_PERSISTENCE;
    } else {
      process.env.EVENT_WRITE_PERSISTENCE = originalEventWrite;
    }
  });

  it("allows event writes when registration persistence is json", () => {
    delete process.env.REGISTRATION_PERSISTENCE;
    delete process.env.EVENT_WRITE_PERSISTENCE;
    expect(getEventWriteBlockedResponse()).toBeNull();
  });

  it("blocks event writes when registration is prisma and event write is json", async () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    delete process.env.EVENT_WRITE_PERSISTENCE;
    const response = getEventWriteBlockedResponse();
    expect(response).not.toBeNull();
    expect(response?.status).toBe(503);
    await expect(response?.json()).resolves.toEqual({
      error: EVENT_ADMIN_UNAVAILABLE_MESSAGE,
    });
  });

  it("blocks event writes when registration is prisma and event write is unset", () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    expect(getEventWriteBlockedResponse()).not.toBeNull();
  });

  it("allows event writes when registration and event write are prisma", () => {
    process.env.REGISTRATION_PERSISTENCE = "prisma";
    process.env.EVENT_WRITE_PERSISTENCE = "prisma";
    expect(getEventWriteBlockedResponse()).toBeNull();
  });
});
