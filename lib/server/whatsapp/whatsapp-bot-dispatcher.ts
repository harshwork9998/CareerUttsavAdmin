import type { WhatsAppBotAction } from "@/lib/server/whatsapp/registration-conversation";
import {
  dispatchWhatsAppBotActionToMeta,
  type MetaActionDispatchResult,
} from "@/lib/server/whatsapp/meta-action-mapper";
import { getMetaClientConfig } from "@/lib/server/whatsapp/meta-client-config";
import { maskWaId } from "@/lib/server/whatsapp/meta-webhook";
import {
  isWhatsAppRegistrationEntryPassMedia,
  isWhatsAppRegistrationPassFollowUpAction,
} from "@/lib/server/whatsapp/whatsapp-registration-bot-actions";

export type WhatsAppBotDispatchSummary = {
  dispatched: number;
  failed: number;
  results: MetaActionDispatchResult[];
};

export function registrationEntryPassQrDelivered(
  summary: WhatsAppBotDispatchSummary,
  actions: WhatsAppBotAction[]
): boolean {
  for (let index = 0; index < actions.length; index += 1) {
    const action = actions[index];
    if (!isWhatsAppRegistrationEntryPassMedia(action)) {
      continue;
    }
    const outcome = summary.results[index];
    return Boolean(outcome?.success && outcome.actionType === "MEDIA");
  }
  return false;
}

export async function dispatchWhatsAppBotActions(
  to: string,
  actions: WhatsAppBotAction[]
): Promise<WhatsAppBotDispatchSummary> {
  const configResult = getMetaClientConfig();
  if (!configResult.ok) {
    console.warn("[whatsapp-dispatch] outbound not configured", {
      recipient: maskWaId(to),
      actionCount: actions.length,
      errorCode: configResult.errorCode,
    });
    return {
      dispatched: 0,
      failed: actions.length,
      results: actions.map((action) => ({
        actionType: action.type,
        success: false,
        errorCode: configResult.errorCode,
        retryable: false,
      })),
    };
  }

  const results: MetaActionDispatchResult[] = [];
  let dispatched = 0;
  let failed = 0;
  let registrationEntryPassDelivered = false;

  for (const action of actions) {
    if (
      isWhatsAppRegistrationPassFollowUpAction(action) &&
      !registrationEntryPassDelivered
    ) {
      results.push({
        actionType: action.type,
        success: false,
        errorCode: "SKIPPED_REGISTRATION_QR_NOT_DELIVERED",
        retryable: false,
      });
      continue;
    }

    const result = await dispatchWhatsAppBotActionToMeta(to, action);
    results.push(result);
    if (result.success) {
      dispatched += 1;
      if (isWhatsAppRegistrationEntryPassMedia(action)) {
        registrationEntryPassDelivered = true;
      }
    } else {
      failed += 1;
      console.warn("[whatsapp-dispatch] action failed", {
        recipient: maskWaId(to),
        actionType: result.actionType,
        errorCode: result.errorCode,
        retryable: result.retryable ?? false,
      });
    }
  }

  return { dispatched, failed, results };
}
