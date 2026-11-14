import { describe, expect, it } from "vitest";
import { Prisma } from "@/lib/generated/prisma/client";

import { marketingAttributionWriteConflictResult } from "@/lib/server/marketing-attribution-errors";

function uniqueViolation(): Prisma.PrismaClientKnownRequestError {
  return new Prisma.PrismaClientKnownRequestError("Unique constraint", {
    code: "P2002",
    clientVersion: "test",
  });
}

describe("marketingAttributionWriteConflictResult", () => {
  it("maps Prisma unique violations to 409 responses", () => {
    const prismaError = uniqueViolation();
    expect(marketingAttributionWriteConflictResult(prismaError, "lead_source")).toEqual({
      ok: false,
      status: 409,
      error: expect.stringContaining("case-insensitively"),
    });
    expect(
      marketingAttributionWriteConflictResult(prismaError, "lead_sub_source")?.status
    ).toBe(409);
    expect(
      marketingAttributionWriteConflictResult(prismaError, "marketing_campaign")?.error
    ).toMatch(/retired campaigns/);
  });

  it("ignores non-unique errors", () => {
    expect(
      marketingAttributionWriteConflictResult(new Error("other"), "lead_source")
    ).toBeNull();
  });
});