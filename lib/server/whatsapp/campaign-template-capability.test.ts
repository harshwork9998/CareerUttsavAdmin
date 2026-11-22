import { describe, expect, it } from "vitest";

import { assessTemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

describe("assessTemplateCapability", () => {
  it("supports simple body text templates", () => {
    const template: MetaMessageTemplate = {
      name: "event_invite",
      language: "en",
      status: "APPROVED",
      components: [
        { type: "BODY", text: "Hello {{1}}, see you on {{2}}." },
        {
          type: "BUTTONS",
          buttons: [{ type: "QUICK_REPLY", text: "OK" }],
        },
      ],
    };
    const capability = assessTemplateCapability(template);
    expect(capability.supported).toBe(true);
    expect(capability.bodyVariableCount).toBe(2);
  });

  it("blocks media headers", () => {
    const template: MetaMessageTemplate = {
      name: "banner",
      language: "en",
      status: "APPROVED",
      components: [{ type: "HEADER", format: "IMAGE" }],
    };
    const capability = assessTemplateCapability(template);
    expect(capability.supported).toBe(false);
    expect(capability.issues[0]?.code).toBe("unsupported_header_media");
  });
});