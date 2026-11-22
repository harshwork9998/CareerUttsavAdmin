import { describe, expect, it } from "vitest";

import { canAccessRoute, getNavItemsForRole } from "@/lib/access-control";

describe("campaigns access control", () => {
  it("allows campaigns only for superuser", () => {
    expect(canAccessRoute("superuser", "/campaigns")).toBe(true);
    expect(canAccessRoute("user", "/campaigns")).toBe(false);
  });

  it("hides campaigns nav item from regular users", () => {
    const items = getNavItemsForRole("user");
    expect(items.some((item) => item.href === "/campaigns")).toBe(false);
    const superItems = getNavItemsForRole("superuser");
    expect(superItems.some((item) => item.href === "/campaigns")).toBe(true);
  });
});