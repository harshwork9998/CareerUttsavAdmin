import { randomUUID } from "node:crypto";

import { readPortalStorageBucket } from "@/lib/server/partner-portal-storage";

export const LOGO_PATH_SEGMENT = "logo";
export const WRITEUP_PATH_SEGMENT = "souvenir_writeup";
export const SPEAKER_PHOTO_PATH_SEGMENT = "speaker_photo";

export type PortalStorageDocumentKind = "logo" | "souvenir_writeup";

const DOCUMENT_SEGMENTS: Record<PortalStorageDocumentKind, string> = {
  logo: LOGO_PATH_SEGMENT,
  souvenir_writeup: WRITEUP_PATH_SEGMENT,
};

export function sanitizePortalId(value: string): string {
  return value.trim().replace(/[^a-zA-Z0-9_-]/g, "");
}

export function sanitizePortalExtension(extension: string): string {
  const ext = extension.startsWith(".") ? extension.slice(1) : extension;
  return ext.toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function isUuidLike(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    value.trim()
  );
}

export function normalizeStoragePath(path: string): string {
  return path.trim().replace(/\\/g, "/");
}

export function assertPortalPathSafe(path: string): boolean {
  const normalized = normalizeStoragePath(path);
  return Boolean(normalized) && !normalized.includes("..");
}

export function assertPortalPathUsesBucket(bucket: string): boolean {
  return bucket.trim() === readPortalStorageBucket();
}

export function buildPortalDocumentObjectPath(
  partnerId: string,
  kind: PortalStorageDocumentKind,
  extension: string
): string {
  const safePartner = sanitizePortalId(partnerId);
  const safeExt = sanitizePortalExtension(extension);
  return `partners/${safePartner}/${DOCUMENT_SEGMENTS[kind]}/${randomUUID()}.${safeExt}`;
}

export function assertPortalDocumentPathOwnedByPartner(
  storagePath: string,
  partnerId: string,
  kind: PortalStorageDocumentKind
): boolean {
  if (!assertPortalPathSafe(storagePath)) return false;
  const expectedPrefix = `partners/${partnerId.trim()}/${DOCUMENT_SEGMENTS[kind]}/`;
  return normalizeStoragePath(storagePath).startsWith(expectedPrefix);
}

export function buildSpeakerPhotoObjectPath(
  partnerId: string,
  speakerId: string,
  extension: string
): string {
  const safePartner = sanitizePortalId(partnerId);
  const safeSpeaker = sanitizePortalId(speakerId);
  const safeExt = sanitizePortalExtension(extension);
  return `partners/${safePartner}/${SPEAKER_PHOTO_PATH_SEGMENT}/${safeSpeaker}/${randomUUID()}.${safeExt}`;
}

export function assertSpeakerPhotoPathOwnedByPartner(
  storagePath: string,
  partnerId: string,
  speakerId: string
): boolean {
  if (!assertPortalPathSafe(storagePath)) return false;
  const expectedPrefix = `partners/${partnerId.trim()}/${SPEAKER_PHOTO_PATH_SEGMENT}/${speakerId.trim()}/`;
  return normalizeStoragePath(storagePath).startsWith(expectedPrefix);
}
