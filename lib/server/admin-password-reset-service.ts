import { hashAdminPassword } from "@/lib/admin-password";
import { AdminUserError } from "@/lib/server/admin-user-errors";
import { sendAdminPasswordResetEmail } from "@/lib/server/admin-auth-email";
import { shouldThrottleForgotPasswordRequest } from "@/lib/server/admin-forgot-password-throttle";
import { isPrismaAdminUserPersistence } from "@/lib/server/admin-user-persistence-mode";
import {
  findPrismaAdminUserRecordByEmail,
  resetAdminPasswordWithPrismaToken,
  revokeUnusedPrismaResetTokensForUser,
  createPrismaPasswordResetToken,
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

export async function requestAdminPasswordReset(
  email: string,
  context: { ip?: string | null } = {}
): Promise<{ message: string }> {
  const normalized = normalizeEmail(email);

  if (shouldThrottleForgotPasswordRequest({ email: normalized, ip: context.ip })) {
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  if (!isPrismaAdminUserPersistence()) {
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  const user = await findPrismaAdminUserRecordByEmail(normalized);
  if (!user || user.status !== "Active") {
    return { message: FORGOT_PASSWORD_GENERIC_MESSAGE };
  }

  const rawToken = generateRawResetToken();
  const tokenHash = hashResetToken(rawToken);
  const expiresAt = new Date(Date.now() + PASSWORD_RESET_TTL_MS);

  const tokenId = await createPrismaPasswordResetToken({
    userId: user.id,
    tokenHash,
    expiresAt,
  });

  const emailResult = await sendAdminPasswordResetEmail({
    name: user.name,
    email: user.email,
    resetUrl: buildPasswordResetUrl(rawToken),
  });

  if (!emailResult.sent) {
    await revokeUnusedPrismaResetTokensForUser(user.id);
    console.error(
      `[admin-password-reset] Failed to send reset email for user ${user.id}`
    );
  } else {
    void tokenId;
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
