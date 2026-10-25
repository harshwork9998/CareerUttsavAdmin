import type { RegistrationCheckInView } from "@/lib/server/registration-check-in-types";

export type CheckInResultKind =
  | "success"
  | "duplicate"
  | "not_found"
  | "event_mismatch"
  | "error";

export type CheckInScannerResult = {
  kind: CheckInResultKind;
  data?: RegistrationCheckInView;
  message?: string;
};

export function classifyCheckInError(error: unknown): CheckInResultKind {
  if (!(error instanceof Error)) return "error";
  const withMeta = error as Error & { status?: number; code?: string };
  if (withMeta.code === "event_mismatch") return "event_mismatch";
  if (withMeta.status === 404 || withMeta.code === "invalid_registration") {
    return "not_found";
  }
  return "error";
}

export function resultFromCheckInView(
  data: RegistrationCheckInView
): CheckInScannerResult {
  if (data.alreadyCheckedIn) {
    return { kind: "duplicate", data };
  }
  return { kind: "success", data };
}

export function shouldPauseScannerAfterDecode(): boolean {
  return true;
}

export function scannerReadyAfterScanNext(): {
  phase: "scanning";
  lastPayload: null;
  result: null;
} {
  return { phase: "scanning", lastPayload: null, result: null };
}
