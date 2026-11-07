import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

vi.mock("@/lib/server/admin-auth", () => ({
  requireAdminUser: vi.fn(),
}));

vi.mock("@/lib/server/seminar-admin-service", () => ({
  movePartnerSeminarForApi: vi.fn(),
  removePartnerSeminarForApi: vi.fn(),
}));

import { requireAdminUser } from "@/lib/server/admin-auth";
import {
  movePartnerSeminarForApi,
  removePartnerSeminarForApi,
} from "@/lib/server/seminar-admin-service";
import { POST } from "@/app/api/partners/[id]/seminar-assignment/route";

describe("admin seminar assignment route", () => {
  beforeEach(() => {
    vi.mocked(requireAdminUser).mockReset();
    vi.mocked(movePartnerSeminarForApi).mockReset();
    vi.mocked(removePartnerSeminarForApi).mockReset();
  });

  it("rejects a partner service call that is not an admin session", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const response = await POST(
      new Request("http://localhost/api/partners/partner-a/seminar-assignment", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-cu-partner-service-key": "topic-secret",
        },
        body: JSON.stringify({
          action: "move",
          eventId: "evt-001",
          seminarId: "sem-a",
          destinationSeminarId: "sem-b",
        }),
      }),
      { params: Promise.resolve({ id: "partner-a" }) }
    );
    expect(response.status).toBe(401);
    expect(movePartnerSeminarForApi).not.toHaveBeenCalled();
    expect(removePartnerSeminarForApi).not.toHaveBeenCalled();
  });

  it("moves a seminar only after an admin session", async () => {
    vi.mocked(requireAdminUser).mockResolvedValue({
      user: { id: "admin" } as never,
    });
    vi.mocked(movePartnerSeminarForApi).mockResolvedValue({
      ok: true,
      partner: { id: "partner-a", name: "College" } as never,
    });
    const response = await POST(
      new Request("http://localhost/api/partners/partner-a/seminar-assignment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "move",
          eventId: "evt-001",
          seminarId: "sem-a",
          destinationSeminarId: "sem-b",
        }),
      }),
      { params: Promise.resolve({ id: "partner-a" }) }
    );
    expect(response.status).toBe(200);
    expect(movePartnerSeminarForApi).toHaveBeenCalledWith(
      expect.objectContaining({
        partnerId: "partner-a",
        seminarId: "sem-a",
        destinationSeminarId: "sem-b",
      })
    );
  });
});
