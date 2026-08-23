import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import {
  sendWhatsAppButtons,
  sendWhatsAppImage,
  sendWhatsAppList,
  sendWhatsAppText,
  uploadWhatsAppMedia,
} from "@/lib/server/whatsapp/meta-client";

export const META_REPLY_BUTTON_LIMIT = 3;
export const META_BUTTON_TITLE_LIMIT = 20;
export const META_LIST_BUTTON_TEXT_LIMIT = 24;
export const META_LIST_ROW_TITLE_LIMIT = 24;
export const META_LIST_ROW_DESCRIPTION_LIMIT = 72;
export const META_LIST_TOTAL_ROW_LIMIT = 10;

export type MetaActionValidationError = {
  ok: false;
  errorCode: string;
  message: string;
};

export type MetaActionValidationSuccess = {
  ok: true;
};

export type MetaActionValidationResult =
  | MetaActionValidationSuccess
  | MetaActionValidationError;

export type MetaActionDispatchResult = {
  actionType: WhatsAppBotAction["type"];
  success: boolean;
  messageId?: string;
  mediaId?: string;
  errorCode?: string;
  retryable?: boolean;
};

function validationError(
  errorCode: string,
  message: string
): MetaActionValidationError {
  return { ok: false, errorCode, message };
}

export function validateWhatsAppButtonAction(
  action: Extract<WhatsAppBotAction, { type: "BUTTONS" }>
): MetaActionValidationResult {
  if (action.buttons.length === 0) {
    return validationError(
      "META_BUTTONS_EMPTY",
      "Button actions require at least one button"
    );
  }

  if (action.buttons.length > META_REPLY_BUTTON_LIMIT) {
    return validationError(
      "META_BUTTONS_LIMIT_EXCEEDED",
      `Button actions support at most ${META_REPLY_BUTTON_LIMIT} buttons`
    );
  }

  for (const button of action.buttons) {
    if (!button.id.trim()) {
      return validationError(
        "META_BUTTON_ID_MISSING",
        "Button actions require stable button IDs"
      );
    }
    if (!button.title.trim()) {
      return validationError(
        "META_BUTTON_TITLE_MISSING",
        "Button actions require non-empty titles"
      );
    }
    if (button.title.length > META_BUTTON_TITLE_LIMIT) {
      return validationError(
        "META_BUTTON_TITLE_TOO_LONG",
        `Button titles must be at most ${META_BUTTON_TITLE_LIMIT} characters`
      );
    }
  }

  return { ok: true };
}

export function validateWhatsAppListAction(
  action: Extract<WhatsAppBotAction, { type: "LIST" }>
): MetaActionValidationResult {
  if (!action.buttonText.trim()) {
    return validationError(
      "META_LIST_BUTTON_TEXT_MISSING",
      "List actions require a button label"
    );
  }
  if (action.buttonText.length > META_LIST_BUTTON_TEXT_LIMIT) {
    return validationError(
      "META_LIST_BUTTON_TEXT_TOO_LONG",
      `List button labels must be at most ${META_LIST_BUTTON_TEXT_LIMIT} characters`
    );
  }

  const rowCount = action.sections.reduce(
    (count, section) => count + section.rows.length,
    0
  );
  if (rowCount === 0) {
    return validationError(
      "META_LIST_ROWS_EMPTY",
      "List actions require at least one row"
    );
  }
  if (rowCount > META_LIST_TOTAL_ROW_LIMIT) {
    return validationError(
      "META_LIST_ROWS_LIMIT_EXCEEDED",
      `List actions support at most ${META_LIST_TOTAL_ROW_LIMIT} rows`
    );
  }

  for (const section of action.sections) {
    for (const row of section.rows) {
      if (!row.id.trim()) {
        return validationError(
          "META_LIST_ROW_ID_MISSING",
          "List rows require stable interactive IDs"
        );
      }
      if (!row.title.trim()) {
        return validationError(
          "META_LIST_ROW_TITLE_MISSING",
          "List rows require non-empty titles"
        );
      }
      if (row.title.length > META_LIST_ROW_TITLE_LIMIT) {
        return validationError(
          "META_LIST_ROW_TITLE_TOO_LONG",
          `List row titles must be at most ${META_LIST_ROW_TITLE_LIMIT} characters`
        );
      }
      if (
        row.description &&
        row.description.length > META_LIST_ROW_DESCRIPTION_LIMIT
      ) {
        return validationError(
          "META_LIST_ROW_DESCRIPTION_TOO_LONG",
          `List row descriptions must be at most ${META_LIST_ROW_DESCRIPTION_LIMIT} characters`
        );
      }
    }
  }

  return { ok: true };
}

function toDispatchFailure(
  actionType: WhatsAppBotAction["type"],
  result: { success: false; errorCode: string; retryable: boolean }
): MetaActionDispatchResult {
  return {
    actionType,
    success: false,
    errorCode: result.errorCode,
    retryable: result.retryable,
  };
}

export async function dispatchWhatsAppBotActionToMeta(
  to: string,
  action: WhatsAppBotAction
): Promise<MetaActionDispatchResult> {
  switch (action.type) {
    case "TEXT": {
      const result = await sendWhatsAppText({ to, text: action.body });
      if (!result.success) {
        return toDispatchFailure("TEXT", result);
      }
      return {
        actionType: "TEXT",
        success: true,
        messageId: result.messageId,
      };
    }
    case "BUTTONS": {
      const validation = validateWhatsAppButtonAction(action);
      if (!validation.ok) {
        return {
          actionType: "BUTTONS",
          success: false,
          errorCode: validation.errorCode,
          retryable: false,
        };
      }
      const result = await sendWhatsAppButtons({
        to,
        body: action.body,
        buttons: action.buttons,
      });
      if (!result.success) {
        return toDispatchFailure("BUTTONS", result);
      }
      return {
        actionType: "BUTTONS",
        success: true,
        messageId: result.messageId,
      };
    }
    case "LIST": {
      const validation = validateWhatsAppListAction(action);
      if (!validation.ok) {
        return {
          actionType: "LIST",
          success: false,
          errorCode: validation.errorCode,
          retryable: false,
        };
      }
      const result = await sendWhatsAppList({
        to,
        body: action.body,
        buttonText: action.buttonText,
        sections: action.sections,
      });
      if (!result.success) {
        return toDispatchFailure("LIST", result);
      }
      return {
        actionType: "LIST",
        success: true,
        messageId: result.messageId,
      };
    }
    case "MEDIA": {
      const upload = await uploadWhatsAppMedia({
        mimeType: action.mimeType,
        filename: action.filename,
        contentBase64: action.contentBase64,
      });
      if (!upload.success) {
        return toDispatchFailure("MEDIA", upload);
      }

      const image = await sendWhatsAppImage({
        to,
        mediaId: upload.mediaId,
        caption: action.caption,
      });
      if (!image.success) {
        return {
          actionType: "MEDIA",
          success: false,
          errorCode: image.errorCode,
          retryable: image.retryable,
          mediaId: upload.mediaId,
        };
      }

      return {
        actionType: "MEDIA",
        success: true,
        messageId: image.messageId,
        mediaId: upload.mediaId,
      };
    }
    default: {
      const exhaustive: never = action;
      return exhaustive;
    }
  }
}
