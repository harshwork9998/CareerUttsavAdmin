import { isPrismaPartnerPersistence } from "@/lib/server/partner-persistence-mode";
import {
  createPrismaSpoc,
  deletePrismaSpoc,
  findPrismaSpocByEmail,
  getPrismaSpocById,
  isPrismaUniqueConstraintError,
  listPrismaSpocs,
  updatePrismaSpoc,
} from "@/lib/server/spoc-prisma-store";
import {
  findSpocByEmail,
  loadSpocs,
  saveSpocs,
} from "@/lib/server/spocs-persistence";
import { validateSpocInput } from "@/lib/spoc-validation";
import { generateId } from "@/lib/utils";
import type { Spoc } from "@/types";

export type SpocWriteResult =
  | { ok: true; spoc: Spoc; status?: number }
  | { ok: false; status: number; error: string };

export type SpocDeleteResult =
  | { ok: true; spocs: Spoc[] }
  | { ok: false; status: number; error: string };

export async function listSpocsForApi(): Promise<Spoc[]> {
  if (isPrismaPartnerPersistence()) {
    return listPrismaSpocs();
  }
  return loadSpocs();
}

export async function getSpocByIdForApi(id: string): Promise<Spoc | null> {
  if (isPrismaPartnerPersistence()) {
    return getPrismaSpocById(id);
  }
  return loadSpocs().find((spoc) => spoc.id === id) ?? null;
}

export async function createSpocForApi(
  body: Partial<Spoc>
): Promise<SpocWriteResult> {
  const spocs = await listSpocsForApi();
  const emailHint = typeof body.email === "string" ? body.email : "";
  const existing = emailHint
    ? isPrismaPartnerPersistence()
      ? await findPrismaSpocByEmail(emailHint)
      : findSpocByEmail(spocs, emailHint) ?? null
    : null;

  const validated = validateSpocInput(
    body,
    existing ? { phone: existing.phone } : null
  );
  if (!validated.ok) {
    return { ok: false, status: 400, error: validated.error };
  }

  if (existing) {
    const updated: Spoc = {
      ...existing,
      name: validated.data.name,
      organization: validated.data.organization,
      phone: validated.data.phone,
      email: validated.data.email,
      updatedAt: new Date().toISOString(),
    };

    if (isPrismaPartnerPersistence()) {
      try {
        const saved = await updatePrismaSpoc(updated);
        return { ok: true, spoc: saved };
      } catch (error) {
        if (isPrismaUniqueConstraintError(error)) {
          return {
            ok: false,
            status: 409,
            error: "Another SPOC already uses this email",
          };
        }
        throw error;
      }
    }

    saveSpocs(spocs.map((spoc) => (spoc.id === existing.id ? updated : spoc)));
    return { ok: true, spoc: updated };
  }

  const now = new Date().toISOString();
  const created: Spoc = {
    id: generateId(),
    ...validated.data,
    createdAt: now,
    updatedAt: now,
  };

  if (isPrismaPartnerPersistence()) {
    try {
      const saved = await createPrismaSpoc(created);
      return { ok: true, spoc: saved, status: 201 };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return {
          ok: false,
          status: 409,
          error: "Another SPOC already uses this email",
        };
      }
      throw error;
    }
  }

  saveSpocs([created, ...spocs]);
  return { ok: true, spoc: created, status: 201 };
}

export async function updateSpocForApi(
  id: string,
  body: Partial<Spoc>
): Promise<SpocWriteResult> {
  const spocs = await listSpocsForApi();
  const current = spocs.find((spoc) => spoc.id === id);
  if (!current) {
    return { ok: false, status: 404, error: "SPOC not found" };
  }

  const validated = validateSpocInput(
    {
      name: body.name ?? current.name,
      organization: body.organization ?? current.organization,
      phone: body.phone ?? current.phone,
      email: body.email ?? current.email,
    },
    { phone: current.phone }
  );
  if (!validated.ok) {
    return { ok: false, status: 400, error: validated.error };
  }

  const emailOwner = isPrismaPartnerPersistence()
    ? await findPrismaSpocByEmail(validated.data.email)
    : findSpocByEmail(spocs, validated.data.email);
  if (emailOwner && emailOwner.id !== id) {
    return {
      ok: false,
      status: 409,
      error: "Another SPOC already uses this email",
    };
  }

  const updated: Spoc = {
    ...current,
    ...validated.data,
    updatedAt: new Date().toISOString(),
  };

  if (isPrismaPartnerPersistence()) {
    try {
      const saved = await updatePrismaSpoc(updated);
      return { ok: true, spoc: saved };
    } catch (error) {
      if (isPrismaUniqueConstraintError(error)) {
        return {
          ok: false,
          status: 409,
          error: "Another SPOC already uses this email",
        };
      }
      throw error;
    }
  }

  saveSpocs(spocs.map((spoc) => (spoc.id === id ? updated : spoc)));
  return { ok: true, spoc: updated };
}

export async function deleteSpocForApi(id: string): Promise<SpocDeleteResult> {
  if (isPrismaPartnerPersistence()) {
    const existing = await getPrismaSpocById(id);
    if (!existing) {
      return { ok: false, status: 404, error: "SPOC not found" };
    }
    const spocs = await deletePrismaSpoc(id);
    return { ok: true, spocs };
  }

  const spocs = loadSpocs();
  if (!spocs.some((spoc) => spoc.id === id)) {
    return { ok: false, status: 404, error: "SPOC not found" };
  }
  const next = spocs.filter((spoc) => spoc.id !== id);
  saveSpocs(next);
  return { ok: true, spocs: next };
}
