import { describe, expect, it } from "vitest";

import { marketingEntityNameKey } from "@/lib/marketing-attribution/entity-name";

describe("marketingEntityNameKey", () => {
  it("treats names that differ only by case as the same key", () => {
    expect(marketingEntityNameKey("Offline Marketing")).toBe(
      marketingEntityNameKey("offline marketing")
    );
    expect(marketingEntityNameKey("Auto")).toBe(marketingEntityNameKey("auto"));
  });

  it("allows the same sub-source label under different parents at the API key layer", () => {
    const auto = marketingEntityNameKey("Auto");
    expect(auto).toBe("auto");
    expect(auto).toBe(marketingEntityNameKey("AUTO"));
  });
});