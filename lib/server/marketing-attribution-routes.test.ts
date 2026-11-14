import { describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

const requireSuperuser = vi.fn();
const requireAdminUser = vi.fn();

vi.mock("@/lib/server/admin-auth", () => ({
  requireSuperuser,
  requireAdminUser,
}));

vi.mock("@/lib/server/marketing-attribution-service", () => ({
  getMarketingAttributionTreeForApi: vi.fn(async () => ({ sources: [] })),
  createLeadSourceForApi: vi.fn(),
}));

describe("marketing attribution admin auth", () => {
  it("blocks unauthenticated tree access", async () => {
    requireSuperuser.mockResolvedValueOnce(
      NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    );
    const { GET } = await import("@/app/api/marketing-attribution/route");
    const response = await GET();
    expect(response.status).toBe(401);
  });

  it("allows superuser tree access", async () => {
    requireSuperuser.mockResolvedValueOnce({ user: { id: "admin", role: "superuser" } });
    const { GET } = await import("@/app/api/marketing-attribution/route");
    const response = await GET();
    expect(response.status).toBe(200);
  });
});