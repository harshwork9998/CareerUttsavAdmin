import { describe, expect, it } from "vitest";

import { CAREER_UTTSAV_PRINCIPAL_TEMPLATE } from "@/lib/server/whatsapp/campaign-template-fixtures";
import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import {
  buildTemplateComponentsFromMapping,
  validateCampaignTemplateMapping,
} from "@/lib/server/whatsapp/campaign-variable-mapping";

describe("buildTemplateComponentsFromMapping", () => {
  it("builds body parameters from columns and static text", () => {
    const components = buildTemplateComponentsFromMapping({
      mapping: {
        body: [
          { kind: "column", column: "name" },
          { kind: "static", value: "Career Uttsav" },
        ],
      },
      rowData: { name: "Aarav" },
    });
    expect(components).toEqual([
      {
        type: "body",
        parameters: [
          { type: "text", text: "Aarav" },
          { type: "text", text: "Career Uttsav" },
        ],
      },
    ]);
  });

  it("builds document header and dynamic URL button components", () => {
    const capability = assessTemplateCapability(CAREER_UTTSAV_PRINCIPAL_TEMPLATE);
    const mapping = {
      headerDocumentMediaId: "media-pdf-001",
      headerDocumentFilename: "principal.pdf",
      body: [{ kind: "static" as const, value: "Principal" }],
      buttonUrls: [
        {
          urlButtonIndex: 1,
          source: { kind: "static" as const, value: "principals" },
        },
      ],
    };

    const components = buildTemplateComponentsFromMapping({
      mapping,
      rowData: {},
    });

    expect(components).toEqual([
      {
        type: "header",
        parameters: [
          {
            type: "document",
            document: { id: "media-pdf-001", filename: "principal.pdf" },
          },
        ],
      },
      {
        type: "body",
        parameters: [{ type: "text", text: "Principal" }],
      },
      {
        type: "button",
        sub_type: "url",
        index: "1",
        parameters: [{ type: "text", text: "principals" }],
      },
    ]);

    expect(
      validateCampaignTemplateMapping({ capability, mapping })
    ).toBeNull();
  });

  it("rejects missing PDF for document templates", () => {
    const capability = assessTemplateCapability(CAREER_UTTSAV_PRINCIPAL_TEMPLATE);
    expect(
      validateCampaignTemplateMapping({
        capability,
        mapping: {
          body: [{ kind: "static", value: "Name" }],
          buttonUrls: [
            {
              urlButtonIndex: 1,
              source: { kind: "static", value: "x" },
            },
          ],
        },
      })
    ).toContain("Attach the PDF");
  });
});