import { NextResponse } from "next/server";

import {
  createPartnerPortalDocumentUploadIntent,
  isPortalStorageDocumentKind,
} from "@/lib/server/partner-portal-document-upload";
import { requirePartnerPortalServiceAuth } from "@/lib/server/partner-portal-service-auth";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";

export const dynamic = "force-dynamic";

type RouteContext = { params: Promise<{ id: string; kind: string }> };

export async function POST(request: Request, context: RouteContext) {
  const authError = requirePartnerPortalServiceAuth(request);
  if (authError) return authError;

  const { id, kind: kindRaw } = await context.params;
  if (!isPortalStorageDocumentKind(kindRaw)) {
    return NextResponse.json({ error: "Invalid kind" }, { status: 400 });
  }

  const partner = await getPartnerByIdForApi(id);
  if (!partner) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  const result = await createPartnerPortalDocumentUploadIntent({
    partner,
    kind: kindRaw,
    fileName: String(body?.fileName ?? ""),
    mimeType: String(body?.mimeType ?? ""),
    fileSizeBytes: Number(body?.fileSizeBytes) || 0,
  });
  if (!result.ok) {
    return NextResponse.json({ error: result.error }, { status: result.status });
  }
  return NextResponse.json(result.intent);
}
