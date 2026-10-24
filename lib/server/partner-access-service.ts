import { isPartnerPortalEmail } from "@/lib/partner-invite";
import {
  verifyStoredPartnerPassword,
} from "@/lib/partner-credentials";
import { isPartnerPasswordHash } from "@/lib/partner-password";
import { generateTemporaryPassword } from "@/lib/partner-temp-password";
import { toPublicPartner, type PublicPartner } from "@/lib/partner-credentials";
import {
  getPartnerByIdForApi,
  updatePartnerForApi,
  findPartnersByPortalLoginForApi,
} from "@/lib/server/partner-service";
import { notifyAfterAccessAccepted } from "@/lib/server/partner-communication-service";
import {
  buildPartnerResetUrl,
  logEmailResult,
  sendPartnerAccessEmail,
  sendPartnerResetEmail,
} from "@/lib/server/partner-access-email";
import {
  consumePartnerResetToken,
  issuePartnerResetToken,
  peekPartnerResetToken,
} from "@/lib/server/partner-password-reset-store";
import type { Partner } from "@/types";

const GENERIC_RESET_MESSAGE =
  "If an account exists, password reset instructions have been sent.";

export type PortalAccessActionResult =
  | {
      ok: true;
      partner: PublicPartner;
      temporaryPassword?: string;
      emailAccepted?: boolean;
      emailOutcome?: string;
      warning?: string;
    }
  | { ok: false; status: number; error: string };

function publicPartner(partner: Partner): PublicPartner {
  return toPublicPartner(partner);
}

export async function generatePartnerPortalPassword(
  partnerId: string
): Promise<PortalAccessActionResult> {
  const existing = await getPartnerByIdForApi(partnerId);
  if (!existing) return { ok: false, status: 404, error: "Not found" };

  const temporaryPassword = generateTemporaryPassword();
  const saved = await updatePartnerForApi(partnerId, {
    portalTempPassword: temporaryPassword,
    portalPasswordChangedAt: undefined,
    portalPasswordPromptSkippedAt: undefined,
  });
  if (!saved.ok) return saved;

  return {
    ok: true,
    partner: publicPartner(saved.partner),
    temporaryPassword,
  };
}

export async function setPartnerPortalAccess(
  partnerId: string,
  enabled: boolean
): Promise<PortalAccessActionResult> {
  const existing = await getPartnerByIdForApi(partnerId);
  if (!existing) return { ok: false, status: 404, error: "Not found" };

  const disabling = enabled === false && existing.portalAccessEnabled === true;
  const saved = await updatePartnerForApi(partnerId, {
    portalAccessEnabled: enabled,
    ...(disabling
      ? { portalAuthVersion: (existing.portalAuthVersion ?? 0) + 1 }
      : {}),
  });
  if (!saved.ok) return saved;
  return { ok: true, partner: publicPartner(saved.partner) };
}

export async function sendPartnerPortalAccessEmail(input: {
  partnerId: string;
  temporaryPassword: string;
  portalLogin?: string;
  portalInviteEmail?: string;
}): Promise<PortalAccessActionResult> {
  const existing = await getPartnerByIdForApi(input.partnerId);
  if (!existing) return { ok: false, status: 404, error: "Not found" };

  const login = (input.portalLogin ?? existing.portalLogin ?? "").trim().toLowerCase();
  const inviteEmail = (input.portalInviteEmail ?? existing.portalInviteEmail ?? "")
    .trim()
    .toLowerCase();
  const temporaryPassword = input.temporaryPassword ?? "";

  if (!isPartnerPortalEmail(login)) {
    return { ok: false, status: 400, error: "Enter a valid login ID." };
  }
  if (!isPartnerPortalEmail(inviteEmail)) {
    return { ok: false, status: 400, error: "Enter a valid invite email." };
  }
  if (existing.portalAccessEnabled !== true) {
    return { ok: false, status: 400, error: "Enable Partner Portal access before sending." };
  }
  if (temporaryPassword.length < 12) {
    return {
      ok: false,
      status: 400,
      error: "Reset password to generate new credentials.",
    };
  }

  const loginOwner = await findPartnersByPortalLoginForApi(login);
  if (loginOwner.some((match) => match.id !== input.partnerId)) {
    return { ok: false, status: 409, error: "That login ID is already in use." };
  }

  const identitySaved = await updatePartnerForApi(input.partnerId, {
    portalLogin: login,
    portalInviteEmail: inviteEmail,
  });
  if (!identitySaved.ok) {
    const duplicate = /unique constraint/i.test(identitySaved.error);
    return duplicate
      ? { ok: false, status: 409, error: "That login ID or invite email is already in use." }
      : identitySaved;
  }

  const current = identitySaved.partner;
  if (!verifyStoredPartnerPassword(current, temporaryPassword)) {
    return {
      ok: false,
      status: 400,
      error: "Reset password to generate new credentials.",
    };
  }

  let emailResult;
  try {
    emailResult = await sendPartnerAccessEmail({
      to: inviteEmail,
      partnerName: current.name,
      login,
      temporaryPassword,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.info("[partner-access-email]", {
      partnerId: current.id,
      outcome: "unknown",
      error: message,
    });
    return {
      ok: true,
      partner: publicPartner(current),
      emailAccepted: false,
      emailOutcome: "unknown",
      warning: "The access email was not sent. You can retry while this password is still on screen.",
    };
  }

  logEmailResult({
    kind: "partner-access-email",
    partnerId: current.id,
    result: emailResult,
  });

  if (!emailResult.ok || emailResult.outcome !== "accepted") {
    return {
      ok: true,
      partner: publicPartner(current),
      emailAccepted: false,
      emailOutcome: emailResult.outcome,
      warning:
        "The access email was not sent. You can retry while this password is still on screen.",
    };
  }

  const marked = await updatePartnerForApi(current.id, {
    portalInviteSentAt: new Date().toISOString(),
  });
  if (!marked.ok) return marked;

  try {
    await notifyAfterAccessAccepted(marked.partner);
  } catch (error) {
    console.info("[partner-communication]", {
      partnerId: marked.partner.id,
      outcome: "unknown",
      error: error instanceof Error ? error.message : "Follow-up email failed",
    });
  }

  return {
    ok: true,
    partner: publicPartner(marked.partner),
    emailAccepted: true,
    emailOutcome: "accepted",
  };
}

export async function requestPartnerPasswordReset(login: string): Promise<{
  message: string;
}> {
  const normalized = login.trim().toLowerCase();
  if (!normalized || !normalized.includes("@")) {
    return { message: GENERIC_RESET_MESSAGE };
  }

  const matches = await findPartnersByPortalLoginForApi(normalized);
  const partner = matches.length === 1 ? matches[0] : undefined;
  if (!partner) {
    console.info("[partner-reset-email]", { outcome: "skipped", reason: "not_found" });
    return { message: GENERIC_RESET_MESSAGE };
  }

  const hashIsScrypt = isPartnerPasswordHash(partner.portalPasswordHash);
  if (partner.portalAccessEnabled !== true || !hashIsScrypt) {
    console.info("[partner-reset-email]", {
      partnerId: partner.id,
      outcome: "skipped",
      reason: partner.portalAccessEnabled === true ? "missing_password" : "access_disabled",
    });
    return { message: GENERIC_RESET_MESSAGE };
  }

  const inviteEmail = partner.portalInviteEmail?.trim() || partner.portalLogin?.trim();
  if (!inviteEmail) {
    console.info("[partner-reset-email]", {
      partnerId: partner.id,
      outcome: "skipped",
      reason: "missing_recipient",
    });
    return { message: GENERIC_RESET_MESSAGE };
  }

  try {
    const token = await issuePartnerResetToken(partner.id);
    const resetUrl = buildPartnerResetUrl(token);
    const result = await sendPartnerResetEmail({
      to: inviteEmail,
      partnerName: partner.name,
      resetUrl,
    });
    logEmailResult({
      kind: "partner-reset-email",
      partnerId: partner.id,
      result,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Email send failed";
    console.info("[partner-reset-email]", {
      partnerId: partner.id,
      outcome: "unknown",
      error: message,
    });
  }

  return { message: GENERIC_RESET_MESSAGE };
}

export async function previewPartnerPasswordReset(token: string): Promise<boolean> {
  if (!token.trim()) return false;
  const record = await peekPartnerResetToken(token.trim());
  return Boolean(record);
}

export async function completePartnerPasswordReset(input: {
  token: string;
  password: string;
}): Promise<{ ok: true } | { ok: false; status: number; error: string }> {
  const token = input.token.trim();
  const password = input.password ?? "";
  if (!token) {
    return { ok: false, status: 400, error: "This reset link is invalid or has expired." };
  }
  if (password.length < 8) {
    return { ok: false, status: 400, error: "Password must be at least 8 characters" };
  }

  const record = await consumePartnerResetToken(token);
  if (!record) {
    return { ok: false, status: 400, error: "This reset link is invalid or has expired." };
  }

  const saved = await updatePartnerForApi(record.partnerId, {
    portalTempPassword: password,
    portalPasswordChangedAt: new Date().toISOString(),
    portalPasswordPromptSkippedAt: undefined,
  });
  if (!saved.ok) {
    return { ok: false, status: saved.status, error: "Could not reset the password." };
  }
  return { ok: true };
}

export async function changePartnerPortalPassword(input: {
  partnerId: string;
  password: string;
}): Promise<
  | { ok: true; portalAuthVersion: number; portalPasswordChangedAt: string }
  | { ok: false; status: number; error: string }
> {
  const existing = await getPartnerByIdForApi(input.partnerId);
  if (!existing || existing.portalAccessEnabled !== true) {
    return { ok: false, status: 401, error: "Invalid login or password." };
  }
  if (input.password.length < 8) {
    return { ok: false, status: 400, error: "Password must be at least 8 characters" };
  }

  const changedAt = new Date().toISOString();
  const saved = await updatePartnerForApi(input.partnerId, {
    portalTempPassword: input.password,
    portalPasswordChangedAt: changedAt,
    portalPasswordPromptSkippedAt: undefined,
  });
  if (!saved.ok) {
    return { ok: false, status: saved.status, error: "Could not update the password." };
  }
  return {
    ok: true,
    portalAuthVersion: saved.partner.portalAuthVersion ?? 0,
    portalPasswordChangedAt: saved.partner.portalPasswordChangedAt ?? changedAt,
  };
}
