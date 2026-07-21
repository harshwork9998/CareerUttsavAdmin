import { isIndianStateOrUt } from "@/lib/indian-states-uts";
import type { Partner } from "@/types";

export function validatePartnerName(name: unknown): string | null {  if (typeof name !== "string") return null;
  const trimmed = name.trim();
  if (trimmed.length < 2) return null;
  if (trimmed.toLowerCase() === "untitled partner") return null;
  return trimmed;
}

export function validatePartnerCity(city: unknown): string | null {
  if (typeof city !== "string") return null;
  const trimmed = city.trim();
  if (trimmed.length < 2) return null;
  return trimmed;
}

export function validatePartnerState(state: unknown): string | null {
  if (typeof state !== "string") return null;
  const trimmed = state.trim();
  return isIndianStateOrUt(trimmed) ? trimmed : null;
}

export function validatePartnerCreate(
  body: Partial<Partner>
): { ok: true; data: Omit<Partner, "id" | "createdAt" | "updatedAt"> } | { ok: false; error: string } {
  const name = validatePartnerName(body.name);
  if (!name) {
    return { ok: false, error: "Partner name is required (at least 2 characters)" };
  }

  const city = body.city ? validatePartnerCity(body.city) : null;
  if (body.city && !city) {
    return {
      ok: false,
      error: "City is required (at least 2 characters)",
    };
  }

  const state = body.state ? validatePartnerState(body.state) : null;
  if (body.state && !state) {
    return {
      ok: false,
      error: "Select a valid state or union territory",
    };
  }

  return {
    ok: true,
    data: {
      ...(body as Omit<Partner, "id" | "createdAt" | "updatedAt">),
      name,
      city: city ?? "",
      state: state ?? "",
      primaryContact: body.primaryContact ?? {
        name: "",
        designation: "",
        phone: "",
        email: "",
      },
      secondaryContact: body.secondaryContact ?? {
        name: "",
        designation: "",
        phone: "",
        email: "",
      },
      eventIds: body.eventIds ?? [],
      relationshipOwner: body.relationshipOwner ?? {
        organization: "",
        managerName: "",
        managerPhone: "",
        managerEmail: "",
      },
      stage: body.stage ?? "New",
      stageRemarks: body.stageRemarks ?? [],
    },
  };
}
