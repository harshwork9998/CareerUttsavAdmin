/**
 * Optional idempotent seed for local/staging marketing attribution config.
 *
 * NOT executed automatically. Run manually only when intended:
 *
 *   npx tsx scripts/seed-marketing-attribution.example.ts
 *
 * Requires DATABASE_URL and applied migration 20261114120000_marketing_attribution.
 */

const EXECUTE_SEED = false;

async function main() {
  if (!EXECUTE_SEED) {
    console.log(
      "Seed skipped (EXECUTE_SEED=false). Set EXECUTE_SEED=true in this file to run."
    );
    return;
  }

  const { prisma } = await import("@/lib/server/prisma");
  const { generateId } = await import("@/lib/utils");
  const { campaignTrackingCodeKey } = await import(
    "@/lib/marketing-attribution/campaign-code"
  );
  const { marketingEntityNameKey } = await import(
    "@/lib/marketing-attribution/entity-name"
  );

  const sourceId = "offline-marketing";
  const now = new Date();

  await prisma.leadSource.upsert({
    where: { id: sourceId },
    create: {
      id: sourceId,
      name: "Offline Marketing",
      nameKey: marketingEntityNameKey("Offline Marketing"),
      description: "On-ground and physical marketing channels",
      isActive: true,
      createdAt: now,
      updatedAt: now,
    },
    update: { updatedAt: now },
  });

  const subSpecs = [
    { id: "offline-auto", name: "Auto" },
    { id: "offline-cabs", name: "Cabs" },
    { id: "offline-btl", name: "BTL" },
  ] as const;

  for (const sub of subSpecs) {
    await prisma.leadSubSource.upsert({
      where: { id: sub.id },
      create: {
        id: sub.id,
        leadSourceId: sourceId,
        name: sub.name,
        nameKey: marketingEntityNameKey(sub.name),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now },
    });
  }

  const campaigns = [
    {
      id: "camp-blr-auto",
      leadSubSourceId: "offline-auto",
      name: "Bengaluru Auto Campaign",
      trackingCode: "AUTO26",
    },
    {
      id: "camp-blr-cabs",
      leadSubSourceId: "offline-cabs",
      name: "Bengaluru Cab Campaign",
      trackingCode: "CABS26",
    },
    {
      id: "camp-btl",
      leadSubSourceId: "offline-btl",
      name: "BTL Campaign",
      trackingCode: "BTL26",
    },
  ] as const;

  for (const camp of campaigns) {
    await prisma.marketingCampaign.upsert({
      where: { trackingCodeKey: campaignTrackingCodeKey(camp.trackingCode) },
      create: {
        id: camp.id,
        leadSubSourceId: camp.leadSubSourceId,
        name: camp.name,
        trackingCode: camp.trackingCode,
        trackingCodeKey: campaignTrackingCodeKey(camp.trackingCode),
        isActive: true,
        createdAt: now,
        updatedAt: now,
      },
      update: { updatedAt: now },
    });
  }

  console.log("Marketing attribution example seed completed.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});