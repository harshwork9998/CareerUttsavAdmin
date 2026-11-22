import { describe, expect, it } from "vitest";

import { buildTemplateComponentsFromMapping } from "@/lib/server/whatsapp/campaign-variable-mapping";

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
});