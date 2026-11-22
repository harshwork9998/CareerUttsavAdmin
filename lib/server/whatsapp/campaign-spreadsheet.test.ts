import { describe, expect, it } from "vitest";

import { parseCsvBuffer } from "@/lib/server/whatsapp/campaign-spreadsheet";

describe("parseCsvBuffer", () => {
  it("reads headers and rows from csv", () => {
    const buffer = Buffer.from(
      "mobile,name\n9876543210,Student A\n919876543211,Student B\n",
      "utf8"
    );
    const parsed = parseCsvBuffer(buffer);
    expect(parsed.headers).toEqual(["mobile", "name"]);
    expect(parsed.rows).toHaveLength(2);
    expect(parsed.detectedMobileColumn).toBe("mobile");
  });
});