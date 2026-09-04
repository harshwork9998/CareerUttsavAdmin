import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sendMock = vi.fn();

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => sendMock(...args),
    },
  })),
}));

import {
  EMAIL_SEND_TIMEOUT_ERROR,
  sendEmail,
} from "@/lib/email";

function mockResendSendWithAbortAwareDelay(
  successDelayMs: number,
  successId = "late-email"
) {
  sendMock.mockImplementation(
    (_payload: unknown, options?: { signal?: AbortSignal }) => {
      return new Promise((resolve) => {
        const successTimer = setTimeout(
          () => resolve({ data: { id: successId }, error: null }),
          successDelayMs
        );

        options?.signal?.addEventListener("abort", () => {
          clearTimeout(successTimer);
          resolve({
            data: null,
            error: {
              message: "Unable to fetch data. The request could not be resolved.",
            },
          });
        });
      });
    }
  );
}

describe("sendEmail timeout", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.RESEND_API_KEY = "re_test_key";
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    vi.useRealTimers();
  });

  it("returns provider message id on successful send", async () => {
    sendMock.mockResolvedValue({ data: { id: "email-123" }, error: null });

    const result = await sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.id).toBe("email-123");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);
    }
    expect(sendMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: "user@careeruttsav.in" }),
      undefined
    );
  });

  it("returns provider failure without revoking semantics at the email layer", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: { message: "Provider unavailable" },
    });

    const result = await sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
    });

    expect(result).toEqual({
      ok: false,
      error: "Provider unavailable",
      durationMs: expect.any(Number),
      outcome: "definitive_failure",
    });
  });

  it("passes AbortSignal to Resend and aborts when the bounded wait expires", async () => {
    vi.useFakeTimers();
    let capturedSignal: AbortSignal | undefined;
    mockResendSendWithAbortAwareDelay(20_000);

    sendMock.mockImplementation(
      (_payload: unknown, options?: { signal?: AbortSignal }) => {
        capturedSignal = options?.signal;
        return new Promise((resolve) => {
          const successTimer = setTimeout(
            () => resolve({ data: { id: "late-email" }, error: null }),
            20_000
          );
          options?.signal?.addEventListener("abort", () => {
            clearTimeout(successTimer);
            resolve({
              data: null,
              error: {
                message:
                  "Unable to fetch data. The request could not be resolved.",
              },
            });
          });
        });
      }
    );

    const sendPromise = sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
      timeoutMs: 12_000,
    });

    await vi.advanceTimersByTimeAsync(12_000);
    const result = await sendPromise;

    expect(capturedSignal?.aborted).toBe(true);
    expect(result).toEqual({
      ok: false,
      error: EMAIL_SEND_TIMEOUT_ERROR,
      durationMs: 12_000,
      outcome: "unknown",
    });
    expect(sendMock).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
  });

  it("does not report a late provider success after an aborted timeout", async () => {
    vi.useFakeTimers();
    mockResendSendWithAbortAwareDelay(20_000, "late-email");

    const sendPromise = sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
      timeoutMs: 12_000,
    });

    await vi.advanceTimersByTimeAsync(12_000);
    const result = await sendPromise;

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toBe(EMAIL_SEND_TIMEOUT_ERROR);
    }

    await vi.advanceTimersByTimeAsync(20_000);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).not.toBe("late-email");
    }
  });

  it("never returns ok=true once the local timeout has fired", async () => {
    vi.useFakeTimers();
    sendMock.mockImplementation((_payload: unknown) => {
      return new Promise((resolve) => {
        setTimeout(
          () => resolve({ data: { id: "late-email" }, error: null }),
          20_000
        );
      });
    });

    const sendPromise = sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
      timeoutMs: 12_000,
    });

    await vi.advanceTimersByTimeAsync(12_000);
    await vi.advanceTimersByTimeAsync(8_000);
    const result = await sendPromise;

    expect(result).toEqual({
      ok: false,
      error: EMAIL_SEND_TIMEOUT_ERROR,
      durationMs: 12_000,
      outcome: "unknown",
    });
  });

  it("classifies ambiguous network failures as unknown", async () => {
    sendMock.mockResolvedValue({
      data: null,
      error: {
        message: "Unable to fetch data. The request could not be resolved.",
      },
    });

    const result = await sendEmail({
      to: "user@careeruttsav.in",
      subject: "Reset",
      html: "<p>Reset</p>",
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.outcome).toBe("unknown");
    }
  });
});
