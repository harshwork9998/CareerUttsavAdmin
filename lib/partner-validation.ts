import { isIndianStateOrUt } from "@/lib/indian-states-uts";
import { validateIndianMobileOnWrite } from "@/lib/indian-mobile";
import { isPartnerPortalEmail } from "@/lib/partner-invite";
import type { Partner, PartnerContact, RelationshipOwner } from "@/types";

export function validatePartnerName(name: unknown): string | null {
  if (typeof name !== "string") return null;
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

function normalizeContactPhones(
  next: PartnerContact | undefined,
  previous: PartnerContact | undefined,
  label: string,
  options?: { requirePhoneWhenPartial?: boolean }
): { ok: true; contact: PartnerContact | undefined } | { ok: false; error: string } {
  if (!next) return { ok: true, contact: next };

  const nextPhone = next.phone?.trim() ?? "";
  const prevPhone = previous?.phone?.trim() ?? "";
  const requireWhenPartial = options?.requirePhoneWhenPartial ?? true;

  // Incomplete draft contact with no phone yet
  if (!nextPhone && !prevPhone) {
    return { ok: true, contact: next };
  }

  const checked = validateIndianMobileOnWrite(next.phone, previous?.phone, {
    required: requireWhenPartial
      ? Boolean(nextPhone || next.name?.trim() || next.email?.trim())
      : Boolean(nextPhone),
    label,
  });
  if (!checked.ok) return checked;
  return { ok: true, contact: { ...next, phone: checked.value } };
}

export function validatePartnerContactPhones(
  next: Partial<Partner>,
  previous?: Partner | null
): { ok: true; patch: Partial<Partner> } | { ok: false; error: string } {
  const patch: Partial<Partner> = { ...next };

  if (next.primaryContact) {
    const result = normalizeContactPhones(
      next.primaryContact,
      previous?.primaryContact,
      "Primary contact mobile"
    );
    if (!result.ok) return result;
    if (result.contact) patch.primaryContact = result.contact;
  }

  if (next.secondaryContact) {
    const result = normalizeContactPhones(
      next.secondaryContact,
      previous?.secondaryContact,
      "Secondary contact mobile",
      { requirePhoneWhenPartial: false }
    );
    if (!result.ok) return result;
    if (result.contact) patch.secondaryContact = result.contact;
    const email = (patch.secondaryContact ?? next.secondaryContact).email?.trim() ?? "";
    if (email && !isPartnerPortalEmail(email)) {
      return { ok: false, error: "Enter a valid secondary contact email" };
    }
  }

  if (next.relationshipOwner) {
    const owner = next.relationshipOwner;
    const prevOwner = previous?.relationshipOwner;
    if (owner.managerPhone?.trim() || prevOwner?.managerPhone?.trim()) {
      const phone = validateIndianMobileOnWrite(
        owner.managerPhone,
        prevOwner?.managerPhone,
        { required: Boolean(owner.managerPhone?.trim()), label: "SPOC / manager mobile" }
      );
      if (!phone.ok) return phone;
      patch.relationshipOwner = {
        ...owner,
        managerPhone: phone.value,
      } satisfies RelationshipOwner;
    }
  }

  return { ok: true, patch };
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

  const phones = validatePartnerContactPhones(body, null);
  if (!phones.ok) {
    return phones;
  }

  return {
    ok: true,
    data: {
      ...(body as Omit<Partner, "id" | "createdAt" | "updatedAt">),
      ...phones.patch,
      name,
      city: city ?? "",
      state: state ?? "",
      primaryContact: (phones.patch.primaryContact as PartnerContact) ??
        body.primaryContact ?? {
          name: "",
          designation: "",
          phone: "",
          email: "",
        },
      secondaryContact: (phones.patch.secondaryContact as PartnerContact) ??
        body.secondaryContact ?? {
          name: "",
          designation: "",
          phone: "",
          email: "",
        },
      eventIds: body.eventIds ?? [],
      relationshipOwner: (phones.patch.relationshipOwner as RelationshipOwner) ??
        body.relationshipOwner ?? {
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
