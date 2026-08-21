import { Prisma } from "@/lib/generated/prisma/client";
import {
  normalizeEmail,
  resolveSpocOrganization,
} from "@/lib/server/partner-prisma-import-map";
import {
  isPrismaUniqueConstraintError,
  mapPrismaSpocToApi,
} from "@/lib/server/partner-prisma-map";
import { prisma } from "@/lib/server/prisma";
import type { Spoc } from "@/types";

function mapSpocWriteInput(spoc: Spoc): Prisma.SpocUncheckedCreateInput {
  const emailNormalized = normalizeEmail(spoc.email);
  if (!emailNormalized) {
    throw new Error("SPOC email is required");
  }

  return {
    id: spoc.id,
    name: spoc.name.trim(),
    organization: resolveSpocOrganization(spoc.organization),
    phone: spoc.phone.trim(),
    email: spoc.email.trim(),
    emailNormalized,
    createdAt: new Date(spoc.createdAt),
    updatedAt: new Date(spoc.updatedAt),
  };
}

export async function listPrismaSpocs(): Promise<Spoc[]> {
  const records = await prisma.spoc.findMany({
    orderBy: { name: "asc" },
  });
  return records.map(mapPrismaSpocToApi);
}

export async function getPrismaSpocById(id: string): Promise<Spoc | null> {
  const record = await prisma.spoc.findUnique({ where: { id } });
  return record ? mapPrismaSpocToApi(record) : null;
}

export async function findPrismaSpocByEmail(email: string): Promise<Spoc | null> {
  const normalized = normalizeEmail(email);
  if (!normalized) return null;
  const record = await prisma.spoc.findUnique({
    where: { emailNormalized: normalized },
  });
  return record ? mapPrismaSpocToApi(record) : null;
}

export async function createPrismaSpoc(spoc: Spoc): Promise<Spoc> {
  const record = await prisma.spoc.create({
    data: mapSpocWriteInput(spoc),
  });
  return mapPrismaSpocToApi(record);
}

export async function updatePrismaSpoc(spoc: Spoc): Promise<Spoc> {
  const record = await prisma.spoc.update({
    where: { id: spoc.id },
    data: {
      ...mapSpocWriteInput(spoc),
      id: undefined,
      createdAt: undefined,
    },
  });
  return mapPrismaSpocToApi(record);
}

export async function deletePrismaSpoc(id: string): Promise<Spoc[]> {
  await prisma.spoc.delete({ where: { id } });
  return listPrismaSpocs();
}

export { isPrismaUniqueConstraintError };
