import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

export type TemplateCapabilityIssue = {
  code: string;
  message: string;
};

export type TemplateTextVariableSlot = {
  component: "body" | "header";
  index: number;
};

export type TemplateCapability = {
  supported: boolean;
  issues: TemplateCapabilityIssue[];
  bodyVariableCount: number;
  headerVariableCount: number;
  bodyVariableSlots: TemplateTextVariableSlot[];
  headerVariableSlots: TemplateTextVariableSlot[];
  previewBody?: string;
  previewHeader?: string;
};

function countVariables(text: string): number {
  const matches = text.match(/\{\{\d+\}\}/g);
  return matches ? matches.length : 0;
}

export function assessTemplateCapability(
  template: MetaMessageTemplate
): TemplateCapability {
  const issues: TemplateCapabilityIssue[] = [];
  let bodyVariableCount = 0;
  let headerVariableCount = 0;
  const bodyVariableSlots: TemplateTextVariableSlot[] = [];
  const headerVariableSlots: TemplateTextVariableSlot[] = [];
  let previewBody: string | undefined;
  let previewHeader: string | undefined;

  for (const component of template.components ?? []) {
    const type = component.type?.toUpperCase();
    if (type === "HEADER") {
      const format = (component.format ?? "TEXT").toUpperCase();
      if (format !== "TEXT") {
        issues.push({
          code: "unsupported_header_media",
          message:
            "This template uses a picture, video, or document header. Campaign sending does not support that yet.",
        });
      } else if (component.text) {
        headerVariableCount = countVariables(component.text);
        previewHeader = component.text;
        for (let i = 0; i < headerVariableCount; i += 1) {
          headerVariableSlots.push({ component: "header", index: i + 1 });
        }
      }
    }

    if (type === "BODY" && component.text) {
      bodyVariableCount = countVariables(component.text);
      previewBody = component.text;
      for (let i = 0; i < bodyVariableCount; i += 1) {
        bodyVariableSlots.push({ component: "body", index: i + 1 });
      }
    }

    if (type === "BUTTONS" && component.buttons?.length) {
      for (const button of component.buttons) {
        const buttonType = button.type?.toUpperCase();
        if (buttonType === "URL" && button.url?.includes("{{")) {
          issues.push({
            code: "unsupported_dynamic_url_button",
            message:
              "This template has a personalised link button. Campaign sending does not support that yet.",
          });
        }
        if (buttonType === "PHONE_NUMBER" || buttonType === "COPY_CODE") {
          issues.push({
            code: "unsupported_button_type",
            message: "This template has a button type that Campaigns cannot send yet.",
          });
        }
      }
    }

    if (type === "CAROUSEL") {
      issues.push({
        code: "unsupported_carousel",
        message: "Carousel templates are not supported in Campaigns.",
      });
    }
  }

  return {
    supported: issues.length === 0,
    issues,
    bodyVariableCount,
    headerVariableCount,
    bodyVariableSlots,
    headerVariableSlots,
    previewBody,
    previewHeader,
  };
}