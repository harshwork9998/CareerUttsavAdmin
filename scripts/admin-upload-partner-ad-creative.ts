/**
 * One-time Admin-side Advertisement Creative upload (dry-run by default).
 *
 * Reuses partner-portal-ad-creative validation, Storage verification, and
 * writePartnerPortalSubmission — no partner login, no JSON surgery.
 *
 * Required:
 *   --partner-id <id>        (from preflight)
 *   --file <absolute-path>
 *   --operator <name>        (execution log)
 *   --confirm-applicable     (ack entitlement preflight)
 *   --confirm-no-overwrite   (ack no existing ad_creative)
 *
 * Mutating upload:
 *   add --execute
 *
 * Examples:
 *   npx tsx scripts/admin-upload-partner-ad-creative.ts --partner-id ... --file "D:\\path\\ad.pdf" --operator "ops" --confirm-applicable --confirm-no-overwrite
 *   npx tsx scripts/admin-upload-partner-ad-creative.ts ... --execute
 */
import fs from "node:fs";
import path from "node:path";

import {
  findSubmittedPortalDocument,
  isSubmittedPortalDocument,
} from "@/lib/partner-portal-document";
import {
  fileExtension,
  resolvedUploadContentType,
  validateUploadFile,
} from "@/lib/partner-upload-policy";
import {
  applyMeaningfulPartnerActivity,
  notifyReadinessTransition,
} from "@/lib/server/partner-communication-service";
import {
  commitPartnerAdCreativeUpload,
  createPartnerAdCreativeUploadIntent,
} from "@/lib/server/partner-portal-ad-creative";
import { createPortalStorageAdminClient } from "@/lib/server/partner-portal-storage";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";
import { prisma } from "@/lib/server/prisma";
import {
  AD_CREATIVE_KIND,
  assessPartnerAdCreativePreflight,
  assertProductionPartnerPersistence,
  flagBool,
  flagString,
  loadProductionAdminEnv,
  parseCliFlags,
  writeExecutionLog,
} from "./lib/partner-ad-creative-admin-shared";

loadProductionAdminEnv();

async function uploadLocalFileToPortalStorage(input: {
  bucket: string;
  objectPath: string;
  filePath: string;
  contentType: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const client = createPortalStorageAdminClient();
  if (!client) {
    return { ok: false, error: "Storage is not configured (SUPABASE_URL / secret key)." };
  }

  const bytes = fs.readFileSync(input.filePath);
  const { error } = await client.storage.from(input.bucket).upload(input.objectPath, bytes, {
    contentType: input.contentType,
    upsert: false,
  });
  if (error) {
    return { ok: false, error: error.message ?? "Storage upload failed." };
  }
  return { ok: true };
}

function usage(): never {
  console.error(`Usage:
  npx tsx scripts/admin-upload-partner-ad-creative.ts \\
    --partner-id <id> \\
    --file <absolute-path> \\
    --operator <name> \\
    --confirm-applicable \\
    --confirm-no-overwrite \\
    [--execute]

Dry-run is the default. Add --execute to upload and commit.`);
  process.exit(1);
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const partnerId = flagString(flags, "partner-id");
  const fileArg = flagString(flags, "file");
  const operator = flagString(flags, "operator");
  const execute = flagBool(flags, "execute");

  if (
    !partnerId ||
    !fileArg ||
    !operator ||
    !flagBool(flags, "confirm-applicable") ||
    !flagBool(flags, "confirm-no-overwrite")
  ) {
    usage();
  }

  const filePath = path.resolve(fileArg);
  if (!path.isAbsolute(filePath)) {
    throw new Error("--file must be an absolute path.");
  }
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${filePath}`);
  }

  assertProductionPartnerPersistence();

  const partner = await getPartnerByIdForApi(partnerId);
  if (!partner) {
    throw new Error(`Partner not found: ${partnerId}`);
  }

  const assessment = assessPartnerAdCreativePreflight(partner);
  if (!assessment.okToUpload) {
    const logPath = writeExecutionLog({
      mode: execute ? "execute_blocked" : "dry_run_blocked",
      timestamp: new Date().toISOString(),
      operator,
      partnerId,
      fileName: path.basename(filePath),
      stopReasons: assessment.stopReasons,
      assessment,
    });
    console.log(
      JSON.stringify(
        {
          ok: false,
          stopReasons: assessment.stopReasons,
          logFile: logPath,
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const fileName = path.basename(filePath);
  const stat = fs.statSync(filePath);
  const mimeType = resolvedUploadContentType(fileName, "");
  const validationError = validateUploadFile({
    fileName,
    fileSizeBytes: stat.size,
    kind: "ad_creative",
    mimeType,
  });
  if (validationError) {
    throw new Error(validationError);
  }

  const dryRunPayload = {
    ok: true,
    mode: "dry_run",
    timestamp: new Date().toISOString(),
    operator,
    partner: {
      id: partner.id,
      name: partner.name,
      city: partner.city,
      state: partner.state,
      sponsorshipTier: partner.sponsorshipTier ?? null,
    },
    file: {
      path: filePath,
      fileName,
      fileSizeBytes: stat.size,
      mimeType,
      extension: fileExtension(fileName),
    },
    note:
      "No Storage upload or database write occurred. Re-run with --execute after approval.",
    assessment,
  };

  if (!execute) {
    const logPath = writeExecutionLog(dryRunPayload);
    console.log(JSON.stringify({ ...dryRunPayload, logFile: logPath }, null, 2));
    return;
  }

  const before = partner;
  const intentResult = await createPartnerAdCreativeUploadIntent({
    partner,
    fileName,
    mimeType,
    fileSizeBytes: stat.size,
  });
  if (!intentResult.ok) {
    throw new Error(`${intentResult.error} (HTTP ${intentResult.status})`);
  }

  const { bucket, path: objectPath } = intentResult.intent;
  const uploadResult = await uploadLocalFileToPortalStorage({
    bucket,
    objectPath,
    filePath,
    contentType: mimeType,
  });
  if (!uploadResult.ok) {
    throw new Error(uploadResult.error);
  }

  const commitResult = await commitPartnerAdCreativeUpload({
    partner: before,
    label: "Advertisement creative",
    fileName,
    mimeType,
    fileSizeBytes: stat.size,
    storageBucket: bucket,
    storagePath: objectPath,
    ifMatchToken: "",
  });

  if (!commitResult.ok) {
    const logPath = writeExecutionLog({
      mode: "execute_commit_failed",
      timestamp: new Date().toISOString(),
      operator,
      partnerId,
      fileName,
      storageBucket: bucket,
      storagePathTail: objectPath.split("/").slice(-2).join("/"),
      error: commitResult.error,
      status: commitResult.status,
    });
    console.log(
      JSON.stringify(
        {
          ok: false,
          error: commitResult.error,
          status: commitResult.status,
          logFile: logPath,
        },
        null,
        2
      )
    );
    process.exit(1);
  }

  let partnerAfter = commitResult.partner;
  try {
    partnerAfter = await applyMeaningfulPartnerActivity(before, partnerAfter);
    await notifyReadinessTransition(before, partnerAfter);
  } catch (error) {
    console.info(
      JSON.stringify({
        partnerId: partnerAfter.id,
        outcome: "communication_skipped",
        error: error instanceof Error ? error.message : "Partner communication failed",
      })
    );
  }

  const committed = findSubmittedPortalDocument(
    partnerAfter.portalDocuments,
    AD_CREATIVE_KIND
  );

  const successLog = writeExecutionLog({
    mode: "execute_success",
    timestamp: new Date().toISOString(),
    operator,
    partnerId: partnerAfter.id,
    fileName,
    storageBucket: bucket,
    storagePathTail: objectPath.split("/").slice(-2).join("/"),
    committed: committed
      ? {
          fileName: committed.fileName,
          fileSizeBytes: committed.fileSizeBytes,
          uploadedAt: committed.uploadedAt,
        }
      : null,
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        mode: "execute",
        partnerId: partnerAfter.id,
        adCreativePresent: Boolean(
          committed && isSubmittedPortalDocument(committed)
        ),
        logFile: successLog,
        nextStep:
          "Run: npx tsx scripts/preflight-partner-ad-creative.ts --partner-id " +
          partnerAfter.id,
      },
      null,
      2
    )
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "upload failed";
    try {
      const logPath = writeExecutionLog({
        mode: "execute_error",
        timestamp: new Date().toISOString(),
        error: message,
      });
      console.error(JSON.stringify({ ok: false, error: message, logFile: logPath }, null, 2));
    } catch {
      console.error(JSON.stringify({ ok: false, error: message }));
    }
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect().catch(() => undefined);
  });
