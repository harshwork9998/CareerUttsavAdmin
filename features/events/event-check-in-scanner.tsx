"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, CheckCircle2, QrCode, ScanLine, AlertTriangle } from "lucide-react";
import { Html5Qrcode } from "html5-qrcode";

import {
  eventCheckInStats,
  normalizeCheckInQrPayload,
  shouldIgnoreDuplicatePayload,
} from "@/lib/check-in-scanner-utils";
import {
  classifyCheckInError,
  resultFromCheckInView,
  scannerReadyAfterScanNext,
  type CheckInScannerResult,
} from "@/lib/check-in-scanner-state";
import { isStudentRegistration } from "@/lib/registration-kinds";
import { registrationMatchesSearch } from "@/features/registrations/registration-table-config";
import { checkInRegistrationApi } from "@/lib/registrations-api-client";
import type { RegistrationCheckInView } from "@/lib/server/registration-check-in-types";
import { eventsService, registrationsService } from "@/services/api";
import { cn, formatDateTimeKolkata, formatNumber } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import type { Registration } from "@/types";

const SCANNER_ELEMENT_ID = "event-check-in-scanner";

type ScannerPhase = "scanning" | "result";

export interface EventCheckInScannerProps {
  eventId: string;
}

function invalidateRegistrationQueries(
  queryClient: ReturnType<typeof useQueryClient>,
  eventId: string
) {
  void queryClient.invalidateQueries({ queryKey: ["registrations"] });
  void queryClient.invalidateQueries({
    queryKey: ["registrations", "event", eventId],
  });
  void queryClient.invalidateQueries({ queryKey: ["events", eventId] });
  void queryClient.invalidateQueries({ queryKey: ["events"] });
  void queryClient.invalidateQueries({ queryKey: ["dashboard"] });
}

function ResultCard({
  result,
  onScanNext,
}: {
  result: CheckInScannerResult;
  onScanNext: () => void;
}) {
  const data = result.data;
  const isSuccess = result.kind === "success";
  const isDuplicate = result.kind === "duplicate";

  if (result.kind === "not_found") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <p className="text-lg font-semibold text-destructive">Registration Not Found</p>
        <p className="mt-1 text-sm text-muted-foreground">Invalid Registration QR</p>
        <Button className="mt-4 w-full" size="lg" onClick={onScanNext}>
          Scan Again
        </Button>
      </div>
    );
  }

  if (result.kind === "event_mismatch") {
    return (
      <div className="rounded-2xl border border-amber-500/40 bg-amber-50 p-5 text-center dark:bg-amber-950/30">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-600" />
        <p className="mt-3 text-lg font-semibold text-foreground">
          This registration belongs to a different event.
        </p>
        <Button className="mt-4 w-full" size="lg" variant="outline" onClick={onScanNext}>
          Scan Again
        </Button>
      </div>
    );
  }

  if (result.kind === "error") {
    return (
      <div className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 text-center">
        <p className="text-lg font-semibold text-destructive">Check-in failed</p>
        <p className="mt-1 text-sm text-muted-foreground">
          {result.message ?? "Please try again."}
        </p>
        <Button className="mt-4 w-full" size="lg" onClick={onScanNext}>
          Scan Again
        </Button>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "rounded-2xl border p-5",
        isSuccess && "border-emerald-500/40 bg-emerald-50 dark:bg-emerald-950/25",
        isDuplicate && "border-amber-500/40 bg-amber-50 dark:bg-amber-950/25"
      )}
    >
      <div className="flex items-center justify-center gap-2">
        {isSuccess ? (
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        ) : (
          <AlertTriangle className="h-8 w-8 text-amber-600" />
        )}
        <p className="text-xl font-semibold">
          {isSuccess ? "Checked In" : "Already Checked In"}
        </p>
      </div>
      {data ? (
        <dl className="mt-4 space-y-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Student Name</dt>
            <dd className="text-base font-medium">{data.studentName}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Registration Number</dt>
            <dd className="font-mono text-base">{data.registrationNumber}</dd>
          </div>
          {data.classLabel ? (
            <div>
              <dt className="text-muted-foreground">Grade / Class</dt>
              <dd className="text-base">{data.classLabel}</dd>
            </div>
          ) : null}
          {data.checkInTime ? (
            <div>
              <dt className="text-muted-foreground">Check-in Time</dt>
              <dd className="text-base">{formatDateTimeKolkata(data.checkInTime)}</dd>
            </div>
          ) : null}
          {data.phoneMasked ? (
            <div>
              <dt className="text-muted-foreground">Phone</dt>
              <dd className="text-base">{data.phoneMasked}</dd>
            </div>
          ) : null}
        </dl>
      ) : null}
      <Button className="mt-5 w-full" size="lg" onClick={onScanNext}>
        Scan Next
      </Button>
    </div>
  );
}

export function EventCheckInScanner({ eventId }: EventCheckInScannerProps) {
  const queryClient = useQueryClient();
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const processingRef = useRef(false);
  const lastPayloadRef = useRef<string | null>(null);
  const lastProcessedAtRef = useRef<number | null>(null);

  const [phase, setPhase] = useState<ScannerPhase>("scanning");
  const [result, setResult] = useState<CheckInScannerResult | null>(null);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualSearch, setManualSearch] = useState("");
  const [cameraError, setCameraError] = useState<string | null>(null);

  const eventQuery = useQuery({
    queryKey: ["events", eventId],
    queryFn: () => eventsService.getById(eventId),
  });

  const registrationsQuery = useQuery({
    queryKey: ["registrations", "event", eventId],
    queryFn: () => registrationsService.getByEvent(eventId),
  });

  const stats = useMemo(
    () => eventCheckInStats(registrationsQuery.data ?? []),
    [registrationsQuery.data]
  );

  const checkInMutation = useMutation({
    mutationFn: (payload: { qrPayload?: string; registrationNumber?: string; registrationId?: string }) =>
      checkInRegistrationApi({
        eventId,
        ...payload,
      }),
    onSuccess: (data: RegistrationCheckInView) => {
      if (!data.alreadyCheckedIn) {
        invalidateRegistrationQueries(queryClient, eventId);
      }
      setResult(resultFromCheckInView(data));
      setPhase("result");
    },
    onError: (error: unknown) => {
      const kind = classifyCheckInError(error);
      setResult({
        kind,
        message: error instanceof Error ? error.message : undefined,
      });
      setPhase("result");
    },
  });

  const stopScanner = useCallback(async () => {
    const instance = scannerRef.current;
    scannerRef.current = null;
    if (!instance) return;
    try {
      if (instance.isScanning) {
        await instance.stop();
      }
      instance.clear();
    } catch {
      // Scanner may already be stopped during unmount.
    }
  }, []);

  const processPayload = useCallback(
    async (raw: string) => {
      const payload = normalizeCheckInQrPayload(raw);
      if (!payload || processingRef.current) return;

      if (
        shouldIgnoreDuplicatePayload(
          lastPayloadRef.current,
          lastProcessedAtRef.current,
          payload
        )
      ) {
        return;
      }

      processingRef.current = true;
      lastPayloadRef.current = payload;
      lastProcessedAtRef.current = Date.now();

      await stopScanner();
      await checkInMutation.mutateAsync({ qrPayload: payload });
      processingRef.current = false;
    },
    [checkInMutation, stopScanner]
  );

  const startScanner = useCallback(async () => {
    if (phase !== "scanning") return;
    setCameraError(null);

    const element = document.getElementById(SCANNER_ELEMENT_ID);
    if (!element) return;

    await stopScanner();

    const scanner = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = scanner;

    const config = {
      fps: 10,
      qrbox: { width: Math.min(280, window.innerWidth - 48), height: 280 },
      aspectRatio: 1,
    };

    const onScan = (decoded: string) => {
      void processPayload(decoded);
    };

    try {
      await scanner.start({ facingMode: "environment" }, config, onScan, () => {});
    } catch {
      try {
        await scanner.start({ facingMode: "user" }, config, onScan, () => {});
      } catch {
        setCameraError(
          "Camera access is required. Allow camera permission or use manual check-in below."
        );
        await stopScanner();
      }
    }
  }, [phase, processPayload, stopScanner]);

  useEffect(() => {
    if (phase !== "scanning") return;
    void startScanner();
    return () => {
      void stopScanner();
    };
  }, [phase, startScanner, stopScanner]);

  const handleScanNext = useCallback(() => {
    const reset = scannerReadyAfterScanNext();
    setPhase(reset.phase);
    setResult(reset.result);
    lastPayloadRef.current = reset.lastPayload;
    lastProcessedAtRef.current = null;
    processingRef.current = false;
  }, []);

  const eventRegistrations = registrationsQuery.data ?? [];
  const manualMatches = useMemo(() => {
    const query = manualSearch.trim().toLowerCase();
    if (!query) return [];
    return eventRegistrations
      .filter((registration) => registrationMatchesSearch(registration, query))
      .slice(0, 12);
  }, [eventRegistrations, manualSearch]);

  const manualCheckIn = async (registration: Registration) => {
    await stopScanner();
    setPhase("result");
    try {
      const data = await checkInMutation.mutateAsync({
        registrationNumber: registration.registrationNumber,
      });
      if (!data.alreadyCheckedIn) {
        invalidateRegistrationQueries(queryClient, eventId);
      }
      setResult(resultFromCheckInView(data));
    } catch (error: unknown) {
      setResult({
        kind: classifyCheckInError(error),
        message: error instanceof Error ? error.message : undefined,
      });
    }
  };

  const event = eventQuery.data;

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-4 px-4 py-4 pb-8">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" asChild className="shrink-0">
          <Link href={`/events/${eventId}`} aria-label="Back to event">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div className="min-w-0">
          <h1 className="text-xl font-semibold leading-tight">Event Check-in</h1>
          {eventQuery.isLoading ? (
            <Skeleton className="mt-1 h-4 w-48" />
          ) : (
            <p className="truncate text-sm text-muted-foreground">{event?.title}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-xl border bg-card p-3 text-center">
        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(stats.checkedIn)}</p>
          <p className="text-xs text-muted-foreground">Checked In</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(stats.total)}</p>
          <p className="text-xs text-muted-foreground">Total Registrations</p>
        </div>
        <div>
          <p className="text-2xl font-semibold tabular-nums">{formatNumber(stats.remaining)}</p>
          <p className="text-xs text-muted-foreground">Remaining</p>
        </div>
      </div>

      {phase === "scanning" ? (
        <div className="space-y-3">
          <p className="text-center text-sm text-muted-foreground">
            Scan the student&apos;s registration QR
          </p>
          <div
            id={SCANNER_ELEMENT_ID}
            className="mx-auto w-full overflow-hidden rounded-2xl border bg-black/5 [&_video]:rounded-2xl"
          />
          {cameraError ? (
            <p className="text-center text-sm text-destructive">{cameraError}</p>
          ) : null}
          {checkInMutation.isPending ? (
            <p className="text-center text-sm font-medium">Processing check-in…</p>
          ) : null}
        </div>
      ) : result ? (
        <ResultCard result={result} onScanNext={handleScanNext} />
      ) : null}

      <div className="rounded-xl border bg-muted/30 p-4">
        <button
          type="button"
          className="flex w-full items-center justify-between text-left text-sm font-medium"
          onClick={() => setManualOpen((open) => !open)}
        >
          <span>Can&apos;t scan the QR?</span>
          <ScanLine className="h-4 w-4 text-muted-foreground" />
        </button>
        {manualOpen ? (
          <div className="mt-3 space-y-3">
            <Input
              placeholder="Pass ID, name, or phone…"
              value={manualSearch}
              onChange={(e) => setManualSearch(e.target.value)}
              className="h-11"
            />
            <ul className="max-h-64 space-y-2 overflow-y-auto">
              {manualMatches.map((registration) => (
                <li
                  key={registration.id}
                  className="flex flex-col gap-2 rounded-lg border bg-card p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">
                      {isStudentRegistration(registration)
                        ? registration.studentName
                        : registration.registrationNumber}
                    </p>
                    <p className="font-mono text-xs text-muted-foreground">
                      {registration.registrationNumber}
                    </p>
                    <p className="text-xs text-muted-foreground">{registration.status}</p>
                  </div>
                  <Button
                    size="sm"
                    className="shrink-0"
                    disabled={checkInMutation.isPending}
                    onClick={() => void manualCheckIn(registration)}
                  >
                    Mark Checked In
                  </Button>
                </li>
              ))}
            </ul>
            {manualSearch.trim() && manualMatches.length === 0 ? (
              <p className="text-sm text-muted-foreground">No matching registrations for this event.</p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="flex justify-center">
        <QrCode className="h-5 w-5 text-muted-foreground/50" aria-hidden />
      </div>
    </div>
  );
}
