import type { WhatsAppTemplateComponent } from "@/lib/server/whatsapp/meta-client";

export type CampaignVariableSource =
  | { kind: "static"; value: string }
  | { kind: "column"; column: string };

export type CampaignVariableMapping = {
  header?: CampaignVariableSource[];
  body?: CampaignVariableSource[];
};

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

  if (input.mapping.header?.length) {
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