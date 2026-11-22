import type { TemplateCapability } from "@/lib/server/whatsapp/campaign-template-capability";
import type { WhatsAppTemplateComponent } from "@/lib/server/whatsapp/meta-client";

export type CampaignVariableSource =
  | { kind: "static"; value: string }
  | { kind: "column"; column: string };

export type CampaignButtonUrlMapping = {
  urlButtonIndex: number;
  source: CampaignVariableSource;
};

export type CampaignVariableMapping = {
  header?: CampaignVariableSource[];
  body?: CampaignVariableSource[];
  /** Meta media ID for DOCUMENT header templates (campaign-level). */
  headerDocumentMediaId?: string;
  headerDocumentFilename?: string;
  /** Values for dynamic URL button suffix parameters only. */
  buttonUrls?: CampaignButtonUrlMapping[];
};

export function buildInitialVariableMapping(
  capability: TemplateCapability
): CampaignVariableMapping {
  return {
    header: capability.headerVariableSlots.map(() => ({
      kind: "static",
      value: "",
    })),
    body: capability.bodyVariableSlots.map(() => ({
      kind: "static",
      value: "",
    })),
    headerDocumentMediaId: capability.requiresHeaderDocument ? "" : undefined,
    buttonUrls: capability.urlButtonSlots
      .filter((slot) => slot.dynamic)
      .map((slot) => ({
        urlButtonIndex: slot.urlButtonIndex,
        source: { kind: "static", value: "" },
      })),
  };
}

export function buildTemplateComponentsFromMapping(input: {
  mapping: CampaignVariableMapping;
  rowData: Record<string, string>;
}): WhatsAppTemplateComponent[] {
  const components: WhatsAppTemplateComponent[] = [];

  const resolve = (source: CampaignVariableSource): string => {
    if (source.kind === "static") return source.value;
    const key = source.column.trim().toLowerCase();
    const exact = input.rowData[source.column]?.trim();
    if (exact) return exact;
    for (const [column, value] of Object.entries(input.rowData)) {
      if (column.trim().toLowerCase() === key) {
        return value.trim();
      }
    }
    return "";
  };

  const headerMediaId = input.mapping.headerDocumentMediaId?.trim();
  if (headerMediaId) {
    components.push({
      type: "header",
      parameters: [
        {
          type: "document",
          document: {
            id: headerMediaId,
            ...(input.mapping.headerDocumentFilename?.trim()
              ? { filename: input.mapping.headerDocumentFilename.trim() }
              : {}),
          },
        },
      ],
    });
  } else if (input.mapping.header?.length) {
    components.push({
      type: "header",
      parameters: input.mapping.header.map((source) => ({
        type: "text",
        text: resolve(source),
      })),
    });
  }

  if (input.mapping.body?.length) {
    components.push({
      type: "body",
      parameters: input.mapping.body.map((source) => ({
        type: "text",
        text: resolve(source),
      })),
    });
  }

  for (const button of input.mapping.buttonUrls ?? []) {
    const text = resolve(button.source);
    if (!text) continue;
    components.push({
      type: "button",
      sub_type: "url",
      index: String(button.urlButtonIndex),
      parameters: [{ type: "text", text }],
    });
  }

  return components;
}

export function validateVariableMapping(input: {
  mapping: CampaignVariableMapping;
  headerSlots: number;
  bodySlots: number;
}): string | null {
  const headerLen = input.mapping.header?.length ?? 0;
  const bodyLen = input.mapping.body?.length ?? 0;
  if (headerLen !== input.headerSlots) {
    return `This template needs ${input.headerSlots} header field(s).`;
  }
  if (bodyLen !== input.bodySlots) {
    return `This template needs ${input.bodySlots} message field(s).`;
  }
  return null;
}

function mappingSourceFilled(source: CampaignVariableSource): boolean {
  if (source.kind === "static") return Boolean(source.value?.trim());
  return Boolean(source.column?.trim());
}

export function validateCampaignTemplateMapping(input: {
  capability: TemplateCapability;
  mapping: CampaignVariableMapping;
}): string | null {
  const basic = validateVariableMapping({
    mapping: input.mapping,
    headerSlots: input.capability.headerVariableCount,
    bodySlots: input.capability.bodyVariableCount,
  });
  if (basic) return basic;

  if (input.capability.requiresHeaderDocument) {
    const mediaId = input.mapping.headerDocumentMediaId?.trim();
    if (!mediaId) {
      return "Attach the PDF for this template before saving.";
    }
  }

  const dynamicSlots = input.capability.urlButtonSlots.filter((s) => s.dynamic);
  const mapped = input.mapping.buttonUrls ?? [];
  if (dynamicSlots.length !== mapped.length) {
    return "Complete the personalised link field(s) for this template.";
  }

  for (const slot of dynamicSlots) {
    const entry = mapped.find((m) => m.urlButtonIndex === slot.urlButtonIndex);
    if (!entry || !mappingSourceFilled(entry.source)) {
      return `Enter the link text for “${slot.label}”.`;
    }
  }

  const textSources = [
    ...(input.mapping.header ?? []),
    ...(input.mapping.body ?? []),
  ];
  for (const source of textSources) {
    if (!mappingSourceFilled(source)) {
      return "Complete all template personalisation fields.";
    }
  }

  return null;
}