import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";

import {
  __setPortalStorageClientForTests,
  normalizePortalStorageErrorMessage,
  tusResumableEndpoint,
  verifyPortalStorageObject,
} from "@/lib/server/partner-portal-storage";

const OBJECT_PATH = "partners/partner-001/ad_creative/abc.png";

type StoredObject = { size: number; contentType: string };

/**
 * Mirrors @supabase/storage-js StorageFileApi: info() reads this._getFinalPath.
 * Extracting `const { info } = storage` and calling `info(path)` throws
 * TypeError: Cannot read properties of undefined (reading '_getFinalPath').
 */
class ContextDependentFileApi {
  constructor(
    public bucketId: string,
    private readonly objects: Map<string, StoredObject>,
    private readonly options: { infoThrows?: Error; listError?: string } = {}
  ) {}

  _getFinalPath(path: string) {
    return `${this.bucketId}/${path.replace(/^\/+/, "")}`;
  }

  async info(path: string) {
    const finalPath = this._getFinalPath(path);
    if (this.options.infoThrows) throw this.options.infoThrows;
    const relative = finalPath.slice(this.bucketId.length + 1);
    const object = this.objects.get(relative);
    if (!object) {
      return { data: null, error: { message: "Object not found" } };
    }
    return {
      data: { size: object.size, contentType: object.contentType },
      error: null,
    };
  }

  async list(prefix?: string, options?: { search?: string; limit?: number }) {
    this._getFinalPath(prefix ?? "");
    if (this.options.listError) {
      return { data: null, error: { message: this.options.listError } };
    }
    const entries = [...this.objects.entries()]
      .filter(([path]) => {
        const folder = path.split("/").slice(0, -1).join("/");
        const name = path.split("/").pop() ?? "";
        if ((prefix ?? "") !== folder) return false;
        if (options?.search && !name.includes(options.search)) return false;
        return true;
      })
      .map(([path, object]) => ({
        name: path.split("/").pop() ?? "",
        metadata: { size: object.size, mimetype: object.contentType },
      }));
    return { data: entries.slice(0, options?.limit ?? entries.length), error: null };
  }
}

function clientFor(api: object): SupabaseClient {
  return {
    storage: {
      from: (bucket: string) => {
        if (api instanceof ContextDependentFileApi) {
          api.bucketId = bucket;
        }
        return api;
      },
    },
  } as unknown as SupabaseClient;
}

describe("signed advertisement storage", () => {
  it("targets the signed resumable endpoint, not the session endpoint", () => {
    expect(tusResumableEndpoint("example-ref")).toBe(
      "https://example-ref.storage.supabase.co/storage/v1/upload/resumable/sign"
    );
    expect(tusResumableEndpoint("example-ref")).not.toMatch(/resumable$/);
  });

  it("maps an empty Storage failure to the reported generic message", () => {
    expect(normalizePortalStorageErrorMessage("")).toBe(
      "Upload could not be completed. Please try again."
    );
    expect(normalizePortalStorageErrorMessage("Bucket not found")).toBe(
      "Upload could not be completed. Please try again."
    );
  });

  it("keeps size and expiry messages specific", () => {
    expect(normalizePortalStorageErrorMessage("Payload too large")).toMatch(
      /storage upload limit/
    );
    expect(normalizePortalStorageErrorMessage("Invalid signature")).toMatch(
      /session expired/
    );
  });
});

describe("verifyPortalStorageObject", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => undefined);
    process.env.SUPABASE_URL = "https://example-ref.supabase.co";
    process.env.SUPABASE_SECRET_KEY = "sb_secret_test";
    process.env.SUPABASE_PORTAL_BUCKET = "partner-portal-assets";
  });

  afterEach(() => {
    __setPortalStorageClientForTests(null);
  });

  it("fails if info() is detached from the Storage client", async () => {
    const api = new ContextDependentFileApi("partner-portal-assets", new Map());
    const detached = api.info;
    await expect(detached(OBJECT_PATH)).rejects.toThrow(/_getFinalPath/);
  });

  it("reads object metadata when info() keeps its Storage client this", async () => {
    const api = new ContextDependentFileApi(
      "partner-portal-assets",
      new Map([[OBJECT_PATH, { size: 4096, contentType: "image/png" }]])
    );
    __setPortalStorageClientForTests(clientFor(api));

    const result = await verifyPortalStorageObject(
      "partner-portal-assets",
      OBJECT_PATH
    );

    expect(result).toEqual({
      ok: true,
      info: { size: 4096, mimeType: "image/png" },
    });
  });

  it("returns missing when the object is absent", async () => {
    const api = new ContextDependentFileApi("partner-portal-assets", new Map());
    __setPortalStorageClientForTests(clientFor(api));

    const result = await verifyPortalStorageObject(
      "partner-portal-assets",
      OBJECT_PATH
    );

    expect(result).toEqual({ ok: false, reason: "missing" });
  });

  it("returns a controlled verification_error when info() throws", async () => {
    const api = new ContextDependentFileApi("partner-portal-assets", new Map(), {
      infoThrows: new TypeError("Cannot read properties of undefined (reading '_getFinalPath')"),
    });
    __setPortalStorageClientForTests(clientFor(api));

    const result = await verifyPortalStorageObject(
      "partner-portal-assets",
      OBJECT_PATH
    );

    expect(result).toEqual({ ok: false, reason: "verification_error" });
  });

  it("does not treat a zero-byte object as present", async () => {
    const api = new ContextDependentFileApi(
      "partner-portal-assets",
      new Map([[OBJECT_PATH, { size: 0, contentType: "image/png" }]])
    );
    __setPortalStorageClientForTests(clientFor(api));

    await expect(
      verifyPortalStorageObject("partner-portal-assets", OBJECT_PATH)
    ).resolves.toEqual({ ok: false, reason: "missing" });
  });

  it("falls back to exact object listing when info() is unavailable", async () => {
    const api = {
      async list(prefix?: string, options?: { search?: string }) {
        if (this == null) {
          throw new TypeError("Cannot read properties of undefined (reading 'list')");
        }
        expect(prefix).toBe("partners/partner-001/ad_creative");
        expect(options?.search).toBe("abc.png");
        return {
          data: [
            {
              name: "abc.png-extra.png",
              metadata: { size: 12, mimetype: "image/png" },
            },
            {
              name: "abc.png",
              metadata: { size: 2048, mimetype: "image/jpeg" },
            },
          ],
          error: null,
        };
      },
    };
    __setPortalStorageClientForTests(clientFor(api));

    const result = await verifyPortalStorageObject(
      "partner-portal-assets",
      OBJECT_PATH
    );

    expect(result).toEqual({
      ok: true,
      info: { size: 2048, mimeType: "image/jpeg" },
    });
  });

  it("returns verification_error when object listing fails", async () => {
    const api = {
      async list() {
        return { data: null, error: { message: "list unavailable" } };
      },
    };
    __setPortalStorageClientForTests(clientFor(api));

    await expect(
      verifyPortalStorageObject("partner-portal-assets", OBJECT_PATH)
    ).resolves.toEqual({ ok: false, reason: "verification_error" });
  });
});
