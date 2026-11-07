import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/server/seminar-topic-service", () => ({
  getPartnerSeminarTopicCatalog: vi.fn(),
  savePartnerSeminarTopics: vi.fn(),
}));

import {
  GET,
  PATCH,
} from "@/app/api/partner-portal/partners/[id]/seminar-topics/route";
import {
  getPartnerSeminarTopicCatalog,
  savePartnerSeminarTopics,
} from "@/lib/server/seminar-topic-service";

describe("partner seminar topic route", () => {
  beforeEach(() => {
    process.env.PARTNER_PORTAL_SERVICE_SECRET = "topic-secret";
    vi.mocked(getPartnerSeminarTopicCatalog).mockReset();
    vi.mocked(savePartnerSeminarTopics).mockReset();
  });

  it("rejects a request without the service key", async () => {
    const response = await GET(
      new Request("http://localhost/api/partner-portal/partners/partner-a/seminar-topics"),
      { params: Promise.resolve({ id: "partner-a" }) }
    );
    expect(response.status).toBe(401);
    expect(getPartnerSeminarTopicCatalog).not.toHaveBeenCalled();
  });

  it("saves topics only for the partner id in the route", async () => {
    vi.mocked(savePartnerSeminarTopics).mockResolvedValue({
      ok: true,
      catalog: {
        confirmedAt: null,
        fullyConfirmed: false,
        canConfirm: false,
        events: [],
      },
    });
    const response = await PATCH(
      new Request("http://localhost/api/partner-portal/partners/partner-a/seminar-topics", {
        method: "PATCH",
        headers: { "x-cu-partner-service-key": "topic-secret" },
        body: JSON.stringify({
          partnerId: "partner-b",
          topics: [{ eventId: "evt-001", seminarId: "sem-a" }],
        }),
      }),
      { params: Promise.resolve({ id: "partner-a" }) }
    );
    expect(response.status).toBe(200);
    expect(savePartnerSeminarTopics).toHaveBeenCalledWith(
      "partner-a",
      expect.objectContaining({
        topics: [{ eventId: "evt-001", seminarId: "sem-a" }],
      })
    );
  });
});
