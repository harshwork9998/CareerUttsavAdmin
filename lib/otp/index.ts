/**
 * Modular OTP service — reusable for student registration, login,
 * and password reset. Import from `@/lib/otp`.
 */
export {
  sendOtp,
  verifyOtp,
  consumePhoneVerification,
  parseOtpPurpose,
  normalizeOtpPhone,
  type SendOtpSuccess,
  type VerifyOtpSuccess,
  type OtpServiceError,
} from "@/lib/otp/service";

export {
  OTP_CONFIG,
  OTP_PURPOSES,
  type OtpPurpose,
  type OtpChallenge,
} from "@/lib/otp/types";
