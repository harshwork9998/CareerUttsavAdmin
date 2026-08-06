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
  MOCK_OTP_CODE,
  type OtpPurpose,
  type OtpChallenge,
} from "@/lib/otp/types";

export { toMsg91Mobile } from "@/lib/otp/phone";
export { resolveOtpProvider } from "@/lib/otp/provider";
