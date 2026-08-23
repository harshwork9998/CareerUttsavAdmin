export type NormalizedMetaError = {
  errorCode: string;
  retryable: boolean;
  httpStatus?: number;
  metaErrorCode?: number;
  metaErrorSubcode?: number;
};

type MetaGraphErrorBody = {
  error?: {
    message?: string;
    type?: string;
    code?: number;
    error_subcode?: number;
    fbtrace_id?: string;
  };
};

function isRetryableHttpStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

export function extractMetaErrorCode(body: unknown): {
  metaErrorCode?: number;
  metaErrorSubcode?: number;
} {
  if (!body || typeof body !== "object") {
    return {};
  }
  const error = (body as MetaGraphErrorBody).error;
  return {
    metaErrorCode:
      typeof error?.code === "number" ? error.code : undefined,
    metaErrorSubcode:
      typeof error?.error_subcode === "number" ? error.error_subcode : undefined,
  };
}

export function normalizeMetaHttpFailure(
  httpStatus: number,
  body: unknown
): NormalizedMetaError {
  const { metaErrorCode, metaErrorSubcode } = extractMetaErrorCode(body);
  const retryable = isRetryableHttpStatus(httpStatus);

  if (httpStatus >= 400 && httpStatus < 500) {
    return {
      errorCode: "META_CLIENT_ERROR",
      retryable,
      httpStatus,
      metaErrorCode,
      metaErrorSubcode,
    };
  }

  return {
    errorCode: "META_SERVER_ERROR",
    retryable,
    httpStatus,
    metaErrorCode,
    metaErrorSubcode,
  };
}

export function normalizeMetaNetworkFailure(error: unknown): NormalizedMetaError {
  if (error instanceof Error && error.name === "AbortError") {
    return {
      errorCode: "META_REQUEST_TIMEOUT",
      retryable: true,
    };
  }

  return {
    errorCode: "META_NETWORK_ERROR",
    retryable: true,
  };
}
