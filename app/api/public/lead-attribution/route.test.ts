import { describe, expect, it } from "vitest";

import { GET } from "@/app/api/public/lead-attribution/route";

describe("public lead attribution API", () => {
  it("requires ref", async () => {
    const res = await GET(new Request("http://localhost/api/public/lead-attribution"));
    expect(res.status).toBe(400);
  });

  it("resolves an active placement", async () => {
    const res = await GET(
      new Request("http://localhost/api/public/lead-attribution?ref=auto-in26")
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      active: true,
      trackingCode: "AUTO-IN26",
      leadSource: "Overhead Marketing",
      leadSubSource: "Auto (Inside)",
    });
    expect(body.whatsappUrl).toContain("api.whatsapp.com");
    expect(body.whatsappPrefill).toContain("inside an auto");
  });

  it("returns inactive for unknown codes without erroring", async () => {
    const res = await GET(
      new Request("http://localhost/api/public/lead-attribution?ref=NOPE")
    );
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body).toEqual({ active: false, trackingCode: "NOPE" });
  });
});