import type { MetaSendResult } from "@/lib/server/whatsapp/meta-client";

/** Meta error codes that indicate limits — do not auto-retry; never return to PENDING. */
export const META_MESSAGING_LIMIT_ERROR_CODES = new Set([
  130429, // rate limit / throughput
  131048, // spam rate limit
  131056, // pair rate limit
  368, // temporarily blocked
]);

export function isSafeToReturnRecipientToPending(input: {
  submissionStarted: boolean;
  reason: string;
}): boolean {
  if (input.submissionStarted) return false;
  return (
    input.reason === "campaign_not_running" ||
    input.reason === "campaign_paused"
  );
}

export function classifyMetaSendFailure(result: MetaSendFailureInput): {
  outcome: "failed" | "needs_review";
  errorCode: string;
} {
  if (
    result.metaErrorCode !== undefined &&
    META_MESSAGING_LIMIT_ERROR_CODES.has(result.metaErrorCode)
  ) {
    return { outcome: "failed", errorCode: "meta_messaging_limit" };
  }

  if (result.errorCode === "META_CLIENT_ERROR" && !result.retryable) {
    return { outcome: "failed", errorCode: result.errorCode };
  }

  if (result.errorCode === "META_INVALID_RESPONSE") {
    return { outcome: "needs_review", errorCode: result.errorCode };
  }

  if (
    result.errorCode === "META_REQUEST_TIMEOUT" ||
    result.errorCode === "META_NETWORK_ERROR" ||
    result.errorCode === "META_SERVER_ERROR" ||
    result.retryable
  ) {
    return { outcome: "needs_review", errorCode: result.errorCode };
  }

  return { outcome: "failed", errorCode: result.errorCode };
}

type MetaSendFailureInput = Extract<MetaSendResult, { success: false }>;

export function recipientMayHaveBeenSubmitted(
  submissionStartedAt: Date | null | undefined
): boolean {
  return submissionStartedAt instanceof Date;
}