/**
 * Read-only production preflight for partner Advertisement Creative upload.
 *
 * Uses Admin .env.local (DATABASE_URL, PARTNER_PERSISTENCE=prisma, Supabase not required).
 * Prints sanitized JSON only — no credentials, emails, or phone numbers.
 *
 * Examples:
 *   npx tsx scripts/preflight-partner-ad-creative.ts --name "PES University" --city Bangalore
 *   npx tsx scripts/preflight-partner-ad-creative.ts --partner-id <confirmed-id>
 */
import { prisma } from "@/lib/server/prisma";
import { getPartnerByIdForApi } from "@/lib/server/partner-service";
import {
  assessPartnerAdCreativePreflight,
  assertProductionPartnerPersistence,
  flagBool,
  flagString,
  loadProductionAdminEnv,
  parseCliFlags,
} from "./lib/partner-ad-creative-admin-shared";

loadProductionAdminEnv();

async function findPartnerIdsByNameCity(input: {
  name: string;
  city?: string;
}): Promise<Array<{ id: string; name: string; city: string; state: string }>> {
  const name = input.name.trim();
  const city = input.city?.trim();

  const rows = await prisma.partner.findMany({
    where: {
      name: { equals: name, mode: "insensitive" },
      ...(city
        ? { city: { equals: city, mode: "insensitive" } }
        : {}),
    },
    select: { id: true, name: true, city: true, state: true },
    orderBy: { id: "asc" },
  });

  return rows;
}

async function main(): Promise<void> {
  const flags = parseCliFlags(process.argv.slice(2));
  const partnerId = flagString(flags, "partner-id");
  const name = flagString(flags, "name");
  const city = flagString(flags, "city");
  const looseName = flagBool(flags, "loose-name");

  if (!partnerId && !name) {
    console.error(
      "Usage: npx tsx scripts/preflight-partner-ad-creative.ts --partner-id <id> | --name \"PES University\" [--city Bangalore]"
    );
    process.exit(1);
  }

  assertProductionPartnerPersistence();

  let resolvedId = partnerId;

  if (!resolvedId && name) {
    let candidates = await findPartnerIdsByNameCity({ name, city });
    if (candidates.length === 0 && looseName) {
      const rows = await prisma.partner.findMany({
        where: {
          name: { contains: name, mode: "insensitive" },
          ...(city ? { city: { contains: city, mode: "insensitive" } } : {}),
        },
        select: { id: true, name: true, city: true, state: true },
        orderBy: { id: "asc" },
      });
      candidates = rows;
    }

    if (candidates.length === 0) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            stopReasons: ["No partner matched the given name/city."],
            search: { name, city: city ?? null },
          },
          null,
          2
        )
      );
      process.exit(2);
    }

    if (candidates.length > 1) {
      console.log(
        JSON.stringify(
          {
            ok: false,
            stopReasons: [
              "Partner identity is ambiguous; confirm a single --partner-id.",
            ],
            search: { name, city: city ?? null },
            candidates: candidates.map((row) => ({
              id: row.id,
              name: row.name,
              city: row.city,
              state: row.state,
            })),
          },
          null,
          2
        )
      );
      process.exit(2);
    }

    resolvedId = candidates[0]!.id;
  }

  const partner = await getPartnerByIdForApi(resolvedId!);
  if (!partner) {
    console.log(
      JSON.stringify(
        {
          ok: false,
          stopReasons: [`Partner not found: ${resolvedId}`],
        },
        null,
        2
      )
    );
    process.exit(2);
  }

  const assessment = assessPartnerAdCreativePreflight(partner);

  console.log(
    JSON.stringify(
      {
        ok: assessment.okToUpload,
        mode: "read_only_preflight",
        timestamp: new Date().toISOString(),
        ...assessment,
      },
      null,
      2
    )
  );

  if (!assessment.okToUpload) {
    process.exit(2);
  }
}

main()
  .catch((error: unknown) => {
    console.error(
      JSON.stringify({
        ok: false,
        error: error instanceof Error ? error.message : "preflight failed",
      })
    );
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
