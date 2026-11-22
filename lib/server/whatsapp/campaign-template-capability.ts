import type { MetaMessageTemplate } from "@/lib/server/whatsapp/meta-templates";

export type TemplateCapabilityIssue = {
  code: string;
  message: string;
};

export type TemplateTextVariableSlot = {
  component: "body" | "header";
  index: number;
};

export type TemplateUrlButtonSlot = {
  /** Index within the template BUTTONS array (for admin labelling). */
  buttonsComponentIndex: number;
  /** Meta send payload index among URL buttons only. */
  urlButtonIndex: number;
  label: string;
  dynamic: boolean;
};

export type TemplateCapability = {
  supported: boolean;
  issues: TemplateCapabilityIssue[];
  bodyVariableCount: number;
  headerVariableCount: number;
  bodyVariableSlots: TemplateTextVariableSlot[];
  headerVariableSlots: TemplateTextVariableSlot[];
  headerFormat?: "TEXT" | "DOCUMENT" | "IMAGE" | "VIDEO";
  requiresHeaderDocument: boolean;
  urlButtonSlots: TemplateUrlButtonSlot[];
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
  const urlButtonSlots: TemplateUrlButtonSlot[] = [];
  let previewBody: string | undefined;
  let previewHeader: string | undefined;
  let headerFormat: TemplateCapability["headerFormat"];
  let requiresHeaderDocument = false;

  for (const component of template.components ?? []) {
    const type = component.type?.toUpperCase();
    if (type === "HEADER") {
      const format = (component.format ?? "TEXT").toUpperCase() as NonNullable<
        TemplateCapability["headerFormat"]
      >;
      headerFormat = format;

      if (format === "DOCUMENT") {
        requiresHeaderDocument = true;
        previewHeader = "PDF document attachment";
      } else if (format === "TEXT" && component.text) {
        headerVariableCount = countVariables(component.text);
        previewHeader = component.text;
        for (let i = 0; i < headerVariableCount; i += 1) {
          headerVariableSlots.push({ component: "header", index: i + 1 });
        }
      } else if (format !== "TEXT") {
        issues.push({
          code: "unsupported_header_media",
          message:
            format === "IMAGE" || format === "VIDEO"
              ? "This template uses a picture or video header. Campaign sending supports document PDF headers only."
              : "This template header format is not supported in Campaigns yet.",
        });
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
      let urlButtonIndex = 0;
      for (let i = 0; i < component.buttons.length; i += 1) {
        const button = component.buttons[i]!;
        const buttonType = button.type?.toUpperCase();
        if (buttonType === "URL") {
          const dynamic = Boolean(button.url?.includes("{{"));
          urlButtonSlots.push({
            buttonsComponentIndex: i,
            urlButtonIndex,
            label: button.text?.trim() || `Link ${urlButtonIndex + 1}`,
            dynamic,
          });
          urlButtonIndex += 1;
        } else if (buttonType === "PHONE_NUMBER" || buttonType === "COPY_CODE") {
          issues.push({
            code: "unsupported_button_type",
            message:
              "This template has a button type that Campaigns cannot send yet.",
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
    headerFormat,
    requiresHeaderDocument,
    urlButtonSlots,
    previewBody,
    previewHeader,
  };
}