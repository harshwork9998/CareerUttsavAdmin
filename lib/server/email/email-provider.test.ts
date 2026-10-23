import { readdirSync, readFileSync, statSync } from "fs";
import path from "path";

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { PASSWORD_RESET_EMAIL_TIMEOUT_MS } from "@/lib/server/admin-auth-email";
import { SMTP_TRANSPORT_TIMEOUT_MS } from "@/lib/server/email/providers/smtp";

const resendSend = vi.fn();
const sendMail = vi.fn();
const closeTransport = vi.fn();
const createTransport = vi.fn((_options: unknown) => ({
  sendMail,
  close: closeTransport,
}));

vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: {
      send: (...args: unknown[]) => resendSend(...args),
    },
  })),
}));

vi.mock("nodemailer", () => ({
  default: {
    createTransport: (options: unknown) => createTransport(options),
  },
}));

import { EMAIL_SEND_TIMEOUT_ERROR, sendEmail } from "@/lib/email";

const ENV_KEYS = [
  "EMAIL_PROVIDER",
  "RESEND_API_KEY",
  "RESEND_FROM_EMAIL",
  "SMTP_HOST",
  "SMTP_PORT",
  "SMTP_REQUIRE_TLS",
  "SMTP_FROM_EMAIL",
  "SMTP_FROM_NAME",
  "SMTP_USER",
  "SMTP_PASS",
] as const;

const originalEnv = Object.fromEntries(
  ENV_KEYS.map((key) => [key, process.env[key]])
);

const message = {
  to: "student@example.com",
  subject: "Welcome",
  html: "<p>Hello <img src=\"cid:registration-qr\"></p>",
  text: "Hello",
  replyTo: "info@careeruttsav.in",
};

function restoreEnv() {
  for (const key of ENV_KEYS) {
    const value = originalEnv[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
}

function useSmtpEnv() {
  process.env.EMAIL_PROVIDER = "smtp";
  process.env.SMTP_HOST = "smtp-relay.gmail.com";
  process.env.SMTP_PORT = "587";
  process.env.SMTP_REQUIRE_TLS = "true";
  process.env.SMTP_FROM_EMAIL = "registrations@careeruttsav.in";
  process.env.SMTP_FROM_NAME = "Career Uttsav";
  delete process.env.SMTP_USER;
  delete process.env.SMTP_PASS;
}

function acceptedSmtp(messageId = "<smtp-123@careeruttsav.in>") {
  sendMail.mockResolvedValue({
    messageId,
    accepted: ["student@example.com"],
    rejected: [],
  });
}

describe("email provider routing", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    restoreEnv();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.RESEND_FROM_EMAIL = "Career Uttsav <onboarding@resend.dev>";
    delete process.env.EMAIL_PROVIDER;
    resendSend.mockResolvedValue({ data: { id: "email-123" }, error: null });
    acceptedSmtp();
  });

  afterEach(() => {
    restoreEnv();
    vi.useRealTimers();
  });

  it("routes EMAIL_PROVIDER=resend through the Resend provider", async () => {
    process.env.EMAIL_PROVIDER = "resend";

    const result = await sendEmail({
      ...message,
      tags: [{ name: "category", value: "student-welcome" }],
    });

    expect(result).toMatchObject({
      ok: true,
      id: "email-123",
      outcome: "accepted",
    });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        to: message.to,
        tags: [{ name: "category", value: "student-welcome" }],
        from: "Career Uttsav <onboarding@resend.dev>",
      }),
      undefined
    );
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("uses Resend when EMAIL_PROVIDER is missing", async () => {
    delete process.env.EMAIL_PROVIDER;
    delete process.env.RESEND_FROM_EMAIL;

    const result = await sendEmail(message);

    expect(result).toMatchObject({ ok: true, id: "email-123", outcome: "accepted" });
    expect(resendSend).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Career Uttsav <onboarding@resend.dev>",
      }),
      undefined
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("routes EMAIL_PROVIDER=smtp through the SMTP provider", async () => {
    useSmtpEnv();

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: true,
      id: "<smtp-123@careeruttsav.in>",
      outcome: "accepted",
    });
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(resendSend).not.toHaveBeenCalled();
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp-relay.gmail.com",
        port: 587,
        secure: false,
        requireTLS: true,
        connectionTimeout: SMTP_TRANSPORT_TIMEOUT_MS,
        greetingTimeout: SMTP_TRANSPORT_TIMEOUT_MS,
        socketTimeout: SMTP_TRANSPORT_TIMEOUT_MS,
      })
    );
    expect(createTransport.mock.calls[0]?.[0]).not.toHaveProperty("auth");
  });

  it("maps HTML, plain text, and Reply-To for SMTP", async () => {
    useSmtpEnv();

    await sendEmail({
      ...message,
      from: "Career Uttsav <custom@careeruttsav.in>",
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        html: message.html,
        text: message.text,
        replyTo: "info@careeruttsav.in",
        from: "Career Uttsav <custom@careeruttsav.in>",
      })
    );
    expect(sendMail.mock.calls[0]?.[0]).not.toHaveProperty("tags");
  });

  it("builds the SMTP From address from SMTP_FROM_NAME and SMTP_FROM_EMAIL", async () => {
    useSmtpEnv();

    await sendEmail({
      to: message.to,
      subject: message.subject,
      html: message.html,
    });

    expect(sendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: "Career Uttsav <registrations@careeruttsav.in>",
      })
    );
  });

  it("maps a CID attachment to a Nodemailer inline cid", async () => {
    useSmtpEnv();
    const content = Buffer.from("qr-png").toString("base64");

    await sendEmail({
      to: message.to,
      subject: message.subject,
      html: message.html,
      attachments: [
        {
          filename: "registration-qr.png",
          content,
          contentId: "registration-qr",
        },
      ],
    });

    const payload = sendMail.mock.calls[0]?.[0] as {
      attachments: Array<{
        filename: string;
        content: Buffer;
        cid: string;
        contentDisposition: string;
      }>;
    };

    expect(payload.attachments).toEqual([
      {
        filename: "registration-qr.png",
        content: Buffer.from(content, "base64"),
        cid: "registration-qr",
        contentDisposition: "inline",
      },
    ]);
    expect(payload.attachments[0]?.content.toString("base64")).toBe(content);
  });

  it("returns the Nodemailer message id when SMTP accepts the message", async () => {
    useSmtpEnv();
    acceptedSmtp("<accepted-id@careeruttsav.in>");

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: true,
      id: "<accepted-id@careeruttsav.in>",
      outcome: "accepted",
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it("returns definitive_failure when SMTP rejects the message", async () => {
    useSmtpEnv();
    sendMail.mockRejectedValue(
      Object.assign(new Error("Mailbox unavailable"), {
        code: "EENVELOPE",
        responseCode: 550,
        command: "RCPT TO",
      })
    );

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      error: "Mailbox unavailable",
      outcome: "definitive_failure",
    });
  });

  it("returns unknown for an SMTP timeout", async () => {
    useSmtpEnv();
    sendMail.mockRejectedValue(
      Object.assign(new Error("Connection timeout"), {
        code: "ETIMEDOUT",
        timeoutType: "CONNECT_TIMEOUT",
      })
    );

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      error: "Connection timeout",
      outcome: "unknown",
    });
  });

  it("returns unknown when the SMTP connection closes ambiguously", async () => {
    useSmtpEnv();
    sendMail.mockRejectedValue(
      Object.assign(new Error("Connection closed unexpectedly"), {
        code: "ECONNECTION",
      })
    );

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      outcome: "unknown",
    });
  });

  it("returns definitive_failure for a refused connection that never accepted mail", async () => {
    useSmtpEnv();
    sendMail.mockRejectedValue(
      Object.assign(new Error("connect ECONNREFUSED"), {
        code: "ESOCKET",
        originalCode: "ECONNREFUSED",
      })
    );

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      outcome: "definitive_failure",
    });
  });

  it("respects timeoutMs and does not classify that timeout as definitive_failure", async () => {
    useSmtpEnv();
    vi.useFakeTimers();
    sendMail.mockImplementation(
      () =>
        new Promise((resolve) => {
          setTimeout(
            () =>
              resolve({
                messageId: "<late@careeruttsav.in>",
                accepted: ["student@example.com"],
                rejected: [],
              }),
            20_000
          );
        })
    );

    const sendPromise = sendEmail({
      ...message,
      timeoutMs: 12_000,
    });

    await vi.advanceTimersByTimeAsync(12_000);
    const result = await sendPromise;

    expect(result).toEqual({
      ok: false,
      error: EMAIL_SEND_TIMEOUT_ERROR,
      durationMs: 12_000,
      outcome: "unknown",
    });
    expect(createTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionTimeout: 12_000,
        greetingTimeout: 12_000,
        socketTimeout: 12_000,
        secure: false,
        requireTLS: true,
      })
    );

    await vi.advanceTimersByTimeAsync(20_000);
    expect(result.ok).toBe(false);
  });

  it("keeps the password-reset email budget at 12 seconds", () => {
    expect(PASSWORD_RESET_EMAIL_TIMEOUT_MS).toBe(12_000);
  });

  it("fails clearly for an invalid EMAIL_PROVIDER without sending", async () => {
    process.env.EMAIL_PROVIDER = "sendgrid";

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      outcome: "definitive_failure",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain('Invalid EMAIL_PROVIDER "sendgrid"');
    }
    expect(resendSend).not.toHaveBeenCalled();
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("fails clearly when SMTP is selected without a host", async () => {
    useSmtpEnv();
    delete process.env.SMTP_HOST;

    const result = await sendEmail(message);

    expect(result).toEqual(
      expect.objectContaining({
        ok: false,
        error: "SMTP_HOST is not set in the environment",
        outcome: "definitive_failure",
      })
    );
    expect(sendMail).not.toHaveBeenCalled();
  });

  it("fails clearly when only one SMTP AUTH value is set", async () => {
    useSmtpEnv();
    process.env.SMTP_USER = "relay-user";

    const result = await sendEmail(message);

    expect(result).toMatchObject({
      ok: false,
      outcome: "definitive_failure",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error).toContain("SMTP_USER and SMTP_PASS");
    }
    expect(createTransport).not.toHaveBeenCalled();
  });

  it("does not require SMTP AUTH for the relay", async () => {
    useSmtpEnv();
    process.env.SMTP_REQUIRE_TLS = "false";

    await sendEmail(message);

    const options = createTransport.mock.calls[0]?.[0] as unknown as {
      auth?: unknown;
      requireTLS?: boolean;
      secure?: boolean;
    };
    expect(options.auth).toBeUndefined();
    expect(options.requireTLS).toBe(false);
    expect(options.secure).toBe(false);
  });

  it("keeps Resend and Nodemailer imports inside the provider modules", () => {
    const skipDirs = new Set([
      "node_modules",
      ".next",
      ".git",
      "tmp",
      "coverage",
      "dist",
      "out",
      "CareerUttsavPartner",
    ]);
    const allowed = new Set([
      "lib/server/email/providers/resend.ts",
      "lib/server/email/providers/smtp.ts",
    ]);
    const offenders: string[] = [];

    function walk(directory: string) {
      for (const entry of readdirSync(directory)) {
        if (skipDirs.has(entry)) continue;
        const absolute = path.join(directory, entry);
        const stats = statSync(absolute);
        if (stats.isDirectory()) {
          walk(absolute);
          continue;
        }
        if (!/\.(ts|tsx|js|mjs|cjs)$/.test(entry) || entry.endsWith(".d.ts")) {
          continue;
        }
        if (entry.includes(".test.")) continue;

        const relative = path.relative(process.cwd(), absolute).replace(/\\/g, "/");
        if (allowed.has(relative)) continue;

        const source = readFileSync(absolute, "utf8");
        if (
          /(?:from\s+|require\(\s*|import\s*\(\s*|import\s+)["'](?:resend|nodemailer)(?:\/[^"']*)?["']/.test(
            source
          )
        ) {
          offenders.push(relative);
        }
      }
    }

    walk(process.cwd());
    expect(offenders).toEqual([]);
  });
});
