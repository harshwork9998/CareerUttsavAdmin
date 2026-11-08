import { afterEach, describe, expect, it } from "vitest";

import {
  readSupabaseSecretKey,
  readSupabaseServiceRoleKey,
} from "@/lib/server/supabase-credentials";

describe("supabase credentials", () => {
  const prior: Record<string, string | undefined> = {};

  afterEach(() => {
    for (const [key, value] of Object.entries(prior)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  function snapshotEnv(keys: string[]) {
    for (const key of keys) {
      prior[key] = process.env[key];
    }
  }

  it("prefers SUPABASE_SECRET_KEY over legacy service role", () => {
    snapshotEnv(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJlegacy";
    expect(readSupabaseSecretKey()).toBe("sb_secret_test");
    expect(readSupabaseServiceRoleKey()).toBe("sb_secret_test");
  });

  it("falls back to SUPABASE_SERVICE_ROLE_KEY when secret key is unset", () => {
    snapshotEnv(["SUPABASE_SECRET_KEY", "SUPABASE_SERVICE_ROLE_KEY"]);
    delete process.env.SUPABASE_SECRET_KEY;
    process.env.SUPABASE_SERVICE_ROLE_KEY = "eyJlegacy";
    expect(readSupabaseSecretKey()).toBe("eyJlegacy");
  });
});
