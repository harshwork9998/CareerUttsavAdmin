import { describe, expect, it } from "vitest";

import { resolveRelationshipOwnerDigestTemplate } from "@/lib/server/relationship-owner-follow-up-template";
import {
  readRelationshipOwnerFollowUpTemplateBase,
  resolveRelationshipOwnerFollowUpTemplateName,
} from "@/lib/server/relationship-owner-follow-up-config";

describe("resolveRelationshipOwnerDigestTemplate", () => {
  const base = "relationship_owner_followup_digest";

  it.each([
    [1, `${base}_1`],
    [2, `${base}_2`],
    [3, `${base}_3`],
    [4, `${base}_4`],
    [5, `${base}_5`],
    [6, `${base}_5_plus`],
    [9, `${base}_5_plus`],
    [20, `${base}_5_plus`],
  ])("maps %i follow-ups to %s", (count, expected) => {
    expect(resolveRelationshipOwnerDigestTemplate(base, count)).toBe(expected);
  });
});

describe("resolveRelationshipOwnerFollowUpTemplateName env", () => {
  it("derives names from RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_BASE", () => {
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_BASE =
      "relationship_owner_followup_digest";
    delete process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME;
    expect(readRelationshipOwnerFollowUpTemplateBase()).toBe(
      "relationship_owner_followup_digest"
    );
    expect(resolveRelationshipOwnerFollowUpTemplateName(2)).toBe(
      "relationship_owner_followup_digest_2"
    );
  });

  it("treats legacy single template name as base", () => {
    delete process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_BASE;
    process.env.RELATIONSHIP_OWNER_FOLLOWUP_TEMPLATE_NAME =
      "relationship_owner_followup_digest";
    expect(resolveRelationshipOwnerFollowUpTemplateName(5)).toBe(
      "relationship_owner_followup_digest_5"
    );
  });
});
