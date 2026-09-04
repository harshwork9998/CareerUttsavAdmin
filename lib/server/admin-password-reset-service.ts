import { hashAdminPassword } from "@/lib/admin-password";
import { AdminUserError } from "@/lib/server/admin-user-errors";
import { sendAdminPasswordResetEmail } from "@/lib/server/admin-auth-email";
import { shouldThrottleForgotPasswordRequest } from "@/lib/server/admin-forgot-password-throttle";
import {
  logPasswordResetError,
  logPasswordResetInfo,
  logPasswordResetWarning,
  maskEmailForLog,
} from "@/lib/server/admin-password-reset-logging";
import { isPrismaAdminUserPersistence } from "@/lib/server/admin-user-persistence-mode";
import {
  findPrismaAdminUserRecordByEmail,
  resetAdminPasswordWithPrismaToken,
  createPrismaPasswordResetToken,
  revokePrismaPasswordResetTokenById,
  revokeOtherUnusedPrismaResetTokensForUser,
} from "@/lib/server/admin-user-prisma-store";
import {
  buildPasswordResetUrl,
  generateRawResetToken,
  hashResetToken,
  INVALID_RESET_LINK_MESSAGE,
  PASSWORD_RESET_TTL_MS,
} from "@/lib/server/admin-reset-token";

export const FORGOT_PASSWORD_GENERIC_MESSAGE =
  "If an account exists for this email, a password reset link has been sent.";

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isResendConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY?.trim());
}

export async function requestAdminPasswordReset(
  email: string,
  context: { ip?: string | null } = {}
): Promise<{ message: string }> {
  const normalized = normalizeEmail(email);
  const maskedEmail = maskEmailForLog(normalized);

  logPasswordResetInfo("request_received", {
    recipient: maskedEmail,
    ip: context.ip ?? undefined,
  });

  if (shouldThrottleForgotPasswordRequest({ email: normalized, ip: context.ip })) {
    logPasswordResetWarning("request_throttled", {
      recipient: maskedEmail,
      ip: context.ip ?? undefined,
    });
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  if (!isPrismaAdminUserPersistence()) {
    logPasswordResetError("persistence_mode_noop", {
      recipient: maskedEmail,
      persistence_mode: process.env.ADMIN_USER_PERSISTENCE ?? "json",
    });
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  const user = await findPrismaAdminUserRecordByEmail(normalized);
  if (!user || user.status !== "Active") {
    logPasswordResetInfo("user_unavailable_noop", {
      recipient: maskedEmail,
      reason: user ? "inactive_or_pending" : "not_found",
    });
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  if (!isResendConfigured()) {
    logPasswordResetError("resend_not_configured", {
      recipient: maskedEmail,
      user_id: user.id,
    });
  }

  const rawToken = generateRawResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  const tokenId = await createPrismaPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  logPasswordResetInfo("token_created", {
    recipient: maskedEmail,
    user_id: user.id,
    token_id: tokenId,
    expires_at: expiresAt.toISOString(),
  });

  const emailResult = await sendAdminPasswordResetEmail({
    name: user.name,
    email: user.email,
    resetUrl: buildPasswordResetUrl(rawToken),
  });

  switch (emailResult.outcome) {
    case "accepted":
      await revokeOtherUnusedPrismaResetTokensForUser(user.id, tokenId);
      logPasswordResetInfo("previous_tokens_invalidated", {
        recipient: maskedEmail,
        user_id: user.id,
        token_id: tokenId,
        message_id: emailResult.messageId,
        duration_ms: emailResult.durationMs,
      });
      break;
    case "definitive_failure":
      await revokePrismaPasswordResetTokenById(tokenId);
      logPasswordResetWarning("new_token_revoked_after_failed_send", {
        recipient: maskedEmail,
        user_id: user.id,
        token_id: tokenId,
        error: emailResult.error,
        duration_ms: emailResult.durationMs,
      });
      break;
    case "unknown":
      logPasswordResetWarning("tokens_preserved_after_unknown_send", {
        recipient: maskedEmail,
        user_id: user.id,
        token_id: tokenId,
        error: emailResult.error,
        duration_ms: emailResult.durationMs,
      });
      break;
  }

  return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
}

export async function resetAdminPasswordWithToken(
  rawToken: string,
  password: string
): Promise<{ message: string }> {
  if (!isPrismaAdminUserPersistence()) {
    throw new AdminUserError(400, INVALID_RESET_LINK_MESSAGE);
  }

  try {
    await resetAdminPasswordWithPrismaToken({
      tokenHash: hashResetToken(rawToken),
      passwordHash: hashAdminPassword(password),
    });
  } catch (error) {
    if (error instanceof AdminUserError) {
      throw error;
    }
    throw new AdminUserError(400, INVALID_RESET_LINK_MESSAGE);
  }

  return {
    message: "Your password has been reset successfully. You can now sign in.",
  };
}
