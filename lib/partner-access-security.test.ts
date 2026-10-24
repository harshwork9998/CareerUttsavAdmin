import { createHash } from "crypto";
import { readFileSync } from "fs";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { applyPartnerCredentialFields, toPublicPartner } from "@/lib/partner-credentials";
import { portalLoginLookupFilter } from "@/lib/partner-login-identity";
import { resetPartnerLoginRateLimits } from "@/lib/partner-login-rate-limit";
import { hashPartnerPassword, verifyPartnerPassword } from "@/lib/partner-password";
import { authenticatePartnerPortalLogin } from "@/lib/partner-portal-auth";
import { generateTemporaryPassword } from "@/lib/partner-temp-password";
import { sendEmail } from "@/lib/email";
import {
  generatePartnerPortalPassword,
  requestPartnerPasswordReset,
  sendPartnerPortalAccessEmail,
  setPartnerPortalAccess,
} from "@/lib/server/partner-access-service";
import {
  findPartnersByPortalLoginForApi,
  getPartnerByIdForApi,
  updatePartnerForApi,
} from "@/lib/server/partner-service";
import { hashPartnerResetToken } from "@/lib/server/partner-password-reset-store";
import { issuePartnerResetToken } from "@/lib/server/partner-password-reset-store";
import type { Partner } from "@/types";

vi.mock("@/lib/email", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/server/partner-service", () => ({
  findPartnersByPortalLoginForApi: vi.fn(),
  getPartnerByIdForApi: vi.fn(),
  updatePartnerForApi: vi.fn(),
}));

vi.mock("@/lib/server/partner-password-reset-store", () => ({
  issuePartnerResetToken: vi.fn(async () => "one-time-reset-token"),
  consumePartnerResetToken: vi.fn(),
  peekPartnerResetToken: vi.fn(),
  hashPartnerResetToken: (token: string) =>
    createHash("sha256").update(token).digest("hex"),
}));

const LOGIN_ERROR = "Invalid login or password.";

function partner(overrides: Partial<Partner> = {}): Partner {
  return {
    id: "partner-001",
    name: "Example Institute",
    city: "Bangalore",
    state: "Karnataka",
    primaryContact: {
      name: "Dean",
      designation: "Dean",
      phone: "9845011001",
      email: "dean@example.edu",
    },
    secondaryContact: {
      name: "Office",
      designation: "Office",
      phone: "9845011002",
      email: "office@example.edu",
    },
    eventIds: [],
    relationshipOwner: {
      organization: "K2",
      managerName: "Owner",
      managerPhone: "9886020001",
      managerEmail: "owner@example.edu",
    },
    stage: "Not Proceeding",
    stageRemarks: [],
    portalLogin: "dean@example.edu",
    portalInviteEmail: "office@example.edu",
    portalAccessEnabled: true,
    portalAuthVersion: 2,
    portalPasswordChangedAt: "2026-08-01T00:00:00.000Z",
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-08-01T00:00:00.000Z",
    ...overrides,
  };
}

describe("temporary passwords", () => {
  it("uses cryptographic randomness and a 12 character mixed set", () => {
    const random = vi.spyOn(Math, "random");
    const password = generateTemporaryPassword();
    expect(random).not.toHaveBeenCalled();
    random.mockRestore();
    expect(password.length).toBeGreaterThanOrEqual(12);
    expect(password).toMatch(/[A-Z]/);
    expect(password).toMatch(/[a-z]/);
    expect(password).toMatch(/[2-9]/);
    expect(password).toMatch(/[!@#$%&*?]/);
    expect(password).not.toMatch(/[IOl01]/);
  });

  it("stores a scrypt hash and never keeps the plaintext", () => {
    const existing = partner();
    const next = applyPartnerCredentialFields(existing, {
      portalTempPassword: "Temp-value-12",
      portalPasswordChangedAt: undefined,
    });
    expect(next.portalTempPassword).toBeUndefined();
    expect(next.portalPasswordHash?.startsWith("scrypt$")).toBe(true);
    expect(next.portalPasswordHash).not.toContain("Temp-value-12");
    expect(next.portalAuthVersion).toBe(3);
    const pub = toPublicPartner(next);
    expect(pub).not.toHaveProperty("portalPasswordHash");
    expect(pub).not.toHaveProperty("portalTempPassword");
    expect(pub.hasPortalPassword).toBe(true);
  });

  it("rejects non-scrypt stored values instead of comparing them as plaintext", () => {
    expect(verifyPartnerPassword("plaintext-value", "plaintext-value")).toBe(false);
    expect(verifyPartnerPassword("anything", "not-a-hash")).toBe(false);
  });
});

describe("login identity and access", () => {
  beforeEach(() => {
    resetPartnerLoginRateLimits();
    vi.clearAllMocks();
  });

  it("looks up portalLoginNormalized only", () => {
    expect(portalLoginLookupFilter(" Dean@Example.edu ")).toEqual({
      portalLoginNormalized: "dean@example.edu",
    });
    expect(Object.keys(portalLoginLookupFilter("dean@example.edu") ?? {})).toEqual([
      "portalLoginNormalized",
    ]);
  });

  it("authenticates an enabled account and ignores stage", async () => {
    const password = "Correct-horse-1";
    const record = partner({ portalPasswordHash: hashPartnerPassword(password) });
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValue([record]);
    const result = await authenticatePartnerPortalLogin({
      login: "Dean@Example.edu",
      password,
      rateLimitKey: "203.0.113.10:dean@example.edu",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mustChangePassword).toBe(false);
    expect(result.partner.stage).toBe("Not Proceeding");
  });

  it("requires a password change when the temporary password has not been replaced", async () => {
    const password = "Correct-horse-1";
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValue([
      partner({
        portalPasswordHash: hashPartnerPassword(password),
        portalPasswordChangedAt: undefined,
        portalPasswordPromptSkippedAt: "2026-08-02T00:00:00.000Z",
      }),
    ]);
    const result = await authenticatePartnerPortalLogin({
      login: "dean@example.edu",
      password,
      rateLimitKey: "203.0.113.11:dean@example.edu",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.mustChangePassword).toBe(true);
  });

  it("returns the same generic error for unknown, disabled, and wrong passwords", async () => {
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValueOnce([]);
    const missing = await authenticatePartnerPortalLogin({
      login: "missing@example.edu",
      password: "wrong-password",
      rateLimitKey: "203.0.113.12:missing@example.edu",
    });
    expect(missing).toMatchObject({ ok: false, status: 401, error: LOGIN_ERROR, reason: "not_found" });

    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValueOnce([
      partner({ portalAccessEnabled: false, portalPasswordHash: hashPartnerPassword("Correct-horse-1") }),
    ]);
    const disabled = await authenticatePartnerPortalLogin({
      login: "dean@example.edu",
      password: "Correct-horse-1",
      rateLimitKey: "203.0.113.13:dean@example.edu",
    });
    expect(disabled).toMatchObject({
      ok: false,
      status: 401,
      error: LOGIN_ERROR,
      reason: "access_disabled",
    });

    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValueOnce([
      partner({ portalPasswordHash: hashPartnerPassword("Correct-horse-1") }),
    ]);
    const wrong = await authenticatePartnerPortalLogin({
      login: "dean@example.edu",
      password: "wrong-password",
      rateLimitKey: "203.0.113.14:dean@example.edu",
    });
    expect(wrong).toMatchObject({
      ok: false,
      status: 401,
      error: LOGIN_ERROR,
      reason: "invalid_credentials",
    });
  });

  it("stops checking passwords after 5 failures in 15 minutes", async () => {
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValue([
      partner({ portalPasswordHash: hashPartnerPassword("Correct-horse-1") }),
    ]);
    const key = "203.0.113.15:dean@example.edu";
    for (let attempt = 0; attempt < 5; attempt += 1) {
      await authenticatePartnerPortalLogin({
        login: "dean@example.edu",
        password: "wrong-password",
        rateLimitKey: key,
      });
    }
    expect(findPartnersByPortalLoginForApi).toHaveBeenCalledTimes(5);
    const blocked = await authenticatePartnerPortalLogin({
      login: "dean@example.edu",
      password: "Correct-horse-1",
      rateLimitKey: key,
    });
    expect(blocked).toMatchObject({ ok: false, error: LOGIN_ERROR, reason: "rate_limited" });
    expect(findPartnersByPortalLoginForApi).toHaveBeenCalledTimes(5);
  });
});

describe("admin access actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a one-time password and a hash, not the plaintext record", async () => {
    const existing = partner({ portalPasswordHash: undefined, portalAuthVersion: 1 });
    vi.mocked(getPartnerByIdForApi).mockResolvedValue(existing);
    vi.mocked(updatePartnerForApi).mockImplementation(async (_id, patch) => ({
      ok: true,
      partner: applyPartnerCredentialFields(existing, patch),
    }));

    const result = await generatePartnerPortalPassword(existing.id);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.temporaryPassword?.length).toBeGreaterThanOrEqual(12);
    expect(result.partner).not.toHaveProperty("portalPasswordHash");
    expect(result.partner).not.toHaveProperty("portalTempPassword");
    expect(result.partner.hasPortalPassword).toBe(true);
    expect(result.partner.portalPasswordChangedAt).toBeUndefined();
    expect(result.partner.portalAuthVersion).toBe(2);
    const stored = vi.mocked(updatePartnerForApi).mock.calls[0]?.[1];
    expect(stored?.portalTempPassword).toBe(result.temporaryPassword);
  });

  it("increments auth version when disabling and not when enabling", async () => {
    vi.mocked(getPartnerByIdForApi).mockResolvedValue(
      partner({ portalAccessEnabled: true, portalAuthVersion: 4 })
    );
    vi.mocked(updatePartnerForApi).mockImplementation(async (_id, patch) => ({
      ok: true,
      partner: partner({ ...patch, portalAuthVersion: patch.portalAuthVersion ?? 4 }),
    }));

    await setPartnerPortalAccess("partner-001", false);
    expect(updatePartnerForApi).toHaveBeenCalledWith(
      "partner-001",
      expect.objectContaining({ portalAccessEnabled: false, portalAuthVersion: 5 })
    );

    vi.mocked(getPartnerByIdForApi).mockResolvedValue(
      partner({ portalAccessEnabled: false, portalAuthVersion: 5 })
    );
    await setPartnerPortalAccess("partner-001", true);
    expect(updatePartnerForApi).toHaveBeenLastCalledWith("partner-001", {
      portalAccessEnabled: true,
    });
  });

  it("marks the invite sent only after sendEmail accepts", async () => {
    const temporaryPassword = "Temp-value-12";
    let current = applyPartnerCredentialFields(partner({ portalAccessEnabled: true }), {
      portalTempPassword: temporaryPassword,
    });
    vi.mocked(getPartnerByIdForApi).mockResolvedValue(current);
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValue([current]);
    vi.mocked(updatePartnerForApi).mockImplementation(async (_id, patch) => {
      current = applyPartnerCredentialFields(current, patch);
      return { ok: true, partner: current };
    });
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "msg-1",
      durationMs: 12,
      outcome: "accepted",
    });

    const sent = await sendPartnerPortalAccessEmail({
      partnerId: current.id,
      temporaryPassword,
      portalLogin: "dean@example.edu",
      portalInviteEmail: "office@example.edu",
    });
    expect(sent.ok).toBe(true);
    if (!sent.ok) return;
    expect(sent.emailAccepted).toBe(true);
    expect(sent.partner.portalInviteSentAt).toBeTruthy();
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: "office@example.edu",
        subject: "You're Onboard! Let's Get Example Institute Event-Ready",
      })
    );
    const mailed = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(mailed?.html).toContain(temporaryPassword);
    expect(mailed?.text).toContain(temporaryPassword);
    expect(mailed?.text).toContain("dean@example.edu");
    const patches = vi.mocked(updatePartnerForApi).mock.calls.map((call) => call[1]);
    expect(patches.some((patch) => Boolean(patch.portalInviteSentAt))).toBe(true);
    expect(JSON.stringify(patches)).not.toContain(temporaryPassword);

    vi.mocked(sendEmail).mockResolvedValue({
      ok: false,
      error: "mailbox unavailable",
      durationMs: 4,
      outcome: "definitive_failure",
    });
    const inviteBefore = current.portalInviteSentAt;
    const failed = await sendPartnerPortalAccessEmail({
      partnerId: current.id,
      temporaryPassword,
      portalLogin: "dean@example.edu",
      portalInviteEmail: "office@example.edu",
    });
    expect(failed.ok).toBe(true);
    if (!failed.ok) return;
    expect(failed.emailAccepted).toBe(false);
    expect(failed.partner.portalInviteSentAt).toBe(inviteBefore);
  });

  it("sends reset mail through sendEmail and does not log the token", async () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => {});
    vi.mocked(findPartnersByPortalLoginForApi).mockResolvedValue([
      partner({ portalPasswordHash: hashPartnerPassword("Correct-horse-1") }),
    ]);
    vi.mocked(sendEmail).mockResolvedValue({
      ok: true,
      id: "msg-2",
      durationMs: 8,
      outcome: "accepted",
    });

    const result = await requestPartnerPasswordReset("dean@example.edu");
    expect(result.message).toBe(
      "If an account exists, password reset instructions have been sent."
    );
    expect(issuePartnerResetToken).toHaveBeenCalledWith("partner-001");
    expect(sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        subject: "Reset your Career Uttsav Partner Portal password",
      })
    );
    const logged = info.mock.calls.map((call) => JSON.stringify(call)).join("\n");
    expect(logged).not.toContain("one-time-reset-token");
    expect(logged).not.toContain("Correct-horse-1");
    info.mockRestore();
  });
});

describe("reset token hashing", () => {
  it("stores a sha256 digest rather than the raw token", () => {
    const token = "raw-token-value";
    const hash = hashPartnerResetToken(token);
    expect(hash).toHaveLength(64);
    expect(hash).not.toBe(token);
    expect(hash).toBe(createHash("sha256").update(token).digest("hex"));
  });
});

describe("obsolete credential delivery", () => {
  it("does not open Gmail or use Math.random for partner access", () => {
    const invite = readFileSync(
      path.join(process.cwd(), "lib/partner-invite.ts"),
      "utf8"
    );
    expect(invite).not.toContain("mail.google.com");
    expect(invite).not.toContain("Math.random");
    const accessEmail = readFileSync(
      path.join(process.cwd(), "lib/server/partner-access-email.ts"),
      "utf8"
    );
    expect(accessEmail).toContain("sendEmail");
    expect(accessEmail).not.toContain("api.resend.com");
  });
});
