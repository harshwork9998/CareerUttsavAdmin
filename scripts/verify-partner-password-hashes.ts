/**
 * Read-only count of Partner.portalPasswordHash shapes.
 * Prints counts only. Never prints hash or password values.
 *
 * Run against the target database before relying on scrypt-only verification:
 *   npx tsx scripts/verify-partner-password-hashes.ts
 *
 * If otherHashes is greater than 0, those rows cannot be verified. Reset them
 * from Admin Partner Access. Do not print the rows.
 */
import { prisma } from "@/lib/server/prisma";

async function main() {
  const rows = await prisma.$queryRaw<
    Array<{ with_hash: bigint; scrypt_hashes: bigint; other_hashes: bigint }>
  >`
    SELECT
      COUNT(*) FILTER (WHERE "portalPasswordHash" IS NOT NULL)::bigint AS with_hash,
      COUNT(*) FILTER (WHERE "portalPasswordHash" LIKE 'scrypt$%')::bigint AS scrypt_hashes,
      COUNT(*) FILTER (
        WHERE "portalPasswordHash" IS NOT NULL
          AND "portalPasswordHash" NOT LIKE 'scrypt$%'
      )::bigint AS other_hashes
    FROM "partners"
  `;

  const row = rows[0];
  console.info(
    JSON.stringify({
      withHash: Number(row?.with_hash ?? 0),
      scryptHashes: Number(row?.scrypt_hashes ?? 0),
      otherHashes: Number(row?.other_hashes ?? 0),
    })
  );
}

main()
  .catch((error: unknown) => {
    const message = error instanceof Error ? error.message : "verification failed";
    console.error(JSON.stringify({ error: message }));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
