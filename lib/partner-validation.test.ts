import { describe, expect, it } from "vitest";

import {
  validatePartnerContactPhones,
  validatePartnerCreate,
} from "@/lib/partner-validation";
import type { Partner, PartnerContact } from "@/types";

const emptySecondary: PartnerContact = {
  name: "",
  designation: "",
  phone: "",
  email: "",
};

const fullPrimary: PartnerContact = {
  name: "Primary Person",
  designation: "Director",
  phone: "9876543210",
  email: "primary@example.edu",
};

function basePartner(secondary: PartnerContact): Partial<Partner> {
  return {
    name: "Example University",
    city: "Bengaluru",
    state: "Karnataka",
    primaryContact: fullPrimary,
    secondaryContact: secondary,
  };
}

describe("Partner secondary contact validation", () => {
  it("keeps primary contact mobile required when cleared on update", () => {
    const previous = {
      id: "p1",
      ...basePartner(emptySecondary),
    } as Partner;

    const missingPrimaryPhone = validatePartnerContactPhones(
      {
        primaryContact: { ...fullPrimary, phone: "" },
      },
      previous
    );
    expect(missingPrimaryPhone.ok).toBe(false);
  });

  it("allows completely blank secondary contact", () => {
    const result = validatePartnerContactPhones(
      basePartner(emptySecondary),
      null
    );
    expect(result.ok).toBe(true);
  });

  it("allows partially populated secondary contact (name only)", () => {
    const result = validatePartnerContactPhones(
      basePartner({ ...emptySecondary, name: "John" }),
      null
    );
    expect(result.ok).toBe(true);
  });

  it("allows phone-only secondary contact when mobile is valid", () => {
    const result = validatePartnerContactPhones(
      basePartner({ ...emptySecondary, phone: "9876501234" }),
      null
    );
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.patch.secondaryContact?.phone).toBe("9876501234");
    }
  });

  it("rejects invalid secondary email only when supplied", () => {
    const result = validatePartnerContactPhones(
      basePartner({ ...emptySecondary, email: "not-an-email" }),
      null
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("secondary contact email");
    }
  });

  it("rejects invalid secondary mobile when supplied", () => {
    const result = validatePartnerContactPhones(
      basePartner({ ...emptySecondary, phone: "12345" }),
      null
    );
    expect(result.ok).toBe(false);
  });

  it("preserves existing secondary contact phone when unchanged", () => {
    const previous = {
      id: "p1",
      ...basePartner({
        name: "Jane",
        designation: "",
        phone: "9000000001",
        email: "jane@example.edu",
      }),
    } as Partner;

    const result = validatePartnerContactPhones(
      {
        secondaryContact: {
          name: "Jane",
          designation: "",
          phone: "9000000001",
          email: "jane@example.edu",
        },
      },
      previous
    );
    expect(result.ok).toBe(true);
  });
});
