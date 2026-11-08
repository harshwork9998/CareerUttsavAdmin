import { createClient, type SupabaseClient } from "@supabase/supabase-js";

import {
  PORTAL_STORAGE_SIZE_MESSAGE,
} from "@/lib/partner-upload-policy";
import { readSupabaseSecretKey } from "@/lib/server/supabase-credentials";

export const DEFAULT_PORTAL_BUCKET = "partner-portal-assets";

const SIGNED_READ_TTL_SECONDS = 60 * 15;

export type PortalStorageObjectInfo = {
  size: number;
  mimeType: string;
  metadata?: Record<string, string>;
};

export type SignedUploadIntent = {
  bucket: string;
  path: string;
  token: string;
  tusEndpoint: string;
};

let testClient: SupabaseClient | null = null;

export function __setPortalStorageClientForTests(client: SupabaseClient | null) {
  testClient = client;
}

export function readSupabaseUrl(): string | null {
  const value = process.env.SUPABASE_URL?.trim();
  return value ? value : null;
}

export function readPortalStorageBucket(): string {
  return process.env.SUPABASE_PORTAL_BUCKET?.trim() || DEFAULT_PORTAL_BUCKET;
}

export function deriveSupabaseProjectRef(supabaseUrl: string): string | null {
  try {
    const host = new URL(supabaseUrl).hostname;
    const ref = host.split(".")[0]?.trim();
    return ref ? ref : null;
  } catch {
    return null;
  }
}

/**
 * Signed TUS endpoint. `x-signature` tokens from createSignedUploadUrl are only
 * accepted at `/upload/resumable/sign`, not the session endpoint `/upload/resumable`.
 */
export function tusResumableEndpoint(projectRef: string): string {
  return `https://${projectRef}.storage.supabase.co/storage/v1/upload/resumable/sign`;
}

export function createPortalStorageAdminClient(): SupabaseClient | null {
  if (testClient) return testClient;
  const url = readSupabaseUrl();
  const key = readSupabaseSecretKey();
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

export function assertPortalStorageConfigured():
  | { ok: true; client: SupabaseClient; bucket: string; projectRef: string }
  | { ok: false; error: string } {
  const client = createPortalStorageAdminClient();
  const url = readSupabaseUrl();
  if (!client || !url) {
    return { ok: false, error: "Storage is not configured." };
  }
  const projectRef = deriveSupabaseProjectRef(url);
  if (!projectRef) {
    return { ok: false, error: "Storage is not configured." };
  }
  return { ok: true, client, bucket: readPortalStorageBucket(), projectRef };
}

export async function createSignedUploadIntent(path: string): Promise<
  | { ok: true; intent: SignedUploadIntent }
  | { ok: false; error: string; status: number }
> {
  const configured = assertPortalStorageConfigured();
  if (!configured.ok) {
    return { ok: false, error: configured.error, status: 503 };
  }
  const { client, bucket, projectRef } = configured;
  const { data, error } = await client.storage.from(bucket).createSignedUploadUrl(path);
  if (error || !data?.token) {
    const statusCode =
      error && "status" in error && typeof error.status === "number"
        ? error.status
        : undefined;
    console.error("[portal-storage] createSignedUploadUrl", {
      status: statusCode ?? "none",
      message: safeStorageLog(error?.message ?? "missing upload token"),
    });
    return {
      ok: false,
      error: normalizePortalStorageErrorMessage(
        error?.message ?? (data?.token ? undefined : "missing upload token")
      ),
      status: 502,
    };
  }
  return {
    ok: true,
    intent: {
      bucket,
      path: data.path ?? path,
      token: data.token,
      tusEndpoint: tusResumableEndpoint(projectRef),
    },
  };
}

export async function verifyPortalStorageObject(
  bucket: string,
  path: string
): Promise<PortalStorageObjectInfo | null> {
  const client = createPortalStorageAdminClient();
  if (!client) return null;
  const infoApi = (
    client.storage.from(bucket) as {
      info?: (objectPath: string) => Promise<{
        data: { size?: number; mimetype?: string; metadata?: Record<string, string> } | null;
        error: { message?: string } | null;
      }>;
    }
  ).info;
  if (typeof infoApi === "function") {
    const { data, error } = await infoApi(path);
    if (error || !data) {
      console.error("[portal-storage] info", error?.message);
      return null;
    }
    const size = Number(data.size) || 0;
    if (size <= 0) return null;
    return {
      size,
      mimeType: data.mimetype?.trim() || "application/octet-stream",
      metadata: data.metadata,
    };
  }

  const listed = await client.storage.from(bucket).list(path.split("/").slice(0, -1).join("/") || undefined, {
    search: path.split("/").pop(),
    limit: 1,
  });
  if (listed.error || !listed.data?.length) {
    return null;
  }
  const item = listed.data[0];
  const size = Number((item as { metadata?: { size?: number } }).metadata?.size) || 0;
  if (size <= 0) return null;
  const mimeType =
    (item as { metadata?: { mimetype?: string } }).metadata?.mimetype?.trim() ||
    "application/octet-stream";
  return { size, mimeType };
}

export async function createPortalDocumentReadUrl(
  bucket: string,
  path: string
): Promise<string | null> {
  const client = createPortalStorageAdminClient();
  if (!client) return null;
  const { data, error } = await client.storage
    .from(bucket)
    .createSignedUrl(path, SIGNED_READ_TTL_SECONDS);
  if (error || !data?.signedUrl) {
    console.error("[portal-storage] createSignedUrl", error?.message);
    return null;
  }
  return data.signedUrl;
}

export async function removePortalStorageObject(
  bucket: string,
  path: string
): Promise<void> {
  const client = createPortalStorageAdminClient();
  if (!client) return;
  const { error } = await client.storage.from(bucket).remove([path]);
  if (error) {
    console.error("[portal-storage] remove", { bucket, path, message: error.message });
  }
}

function safeStorageLog(message: string): string {
  return message
    .replace(/sb_(?:secret|publishable)_[A-Za-z0-9._-]+/g, "[redacted]")
    .replace(/eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 180);
}

export function normalizePortalStorageErrorMessage(message?: string | null): string {
  const text = message?.trim().toLowerCase() ?? "";
  if (!text) {
    return "Upload could not be completed. Please try again.";
  }
  if (
    text.includes("too large") ||
    text.includes("payload too large") ||
    text.includes("entity too large") ||
    text.includes("exceeded the maximum") ||
    text.includes("file size limit")
  ) {
    return PORTAL_STORAGE_SIZE_MESSAGE;
  }
  if (text.includes("expired") || text.includes("invalid signature")) {
    return "Upload session expired. Please try again.";
  }
  if (text.includes("unsupported") || text.includes("not allowed")) {
    return "Please upload SVG, PNG, JPG, PDF, CDR, AI or EPS.";
  }
  return "Upload could not be completed. Please try again.";
}
