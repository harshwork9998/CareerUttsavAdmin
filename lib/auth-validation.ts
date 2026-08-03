import { z } from "zod";

/** Strip non-digits and keep the last 10 digits (handles +91 prefix). */
export function normalizeIndianMobile(value: string): string {
  return value.replace(/\D/g, "").slice(-10);
}

const INDIAN_MOBILE_REGEX = /^[6-9]\d{9}$/;

export const emailFieldSchema = z
  .string()
  .min(1, "Email is required")
  .email("Please enter a valid email address");

export const passwordFieldSchema = z
  .string()
  .min(1, "Password is required")
  .min(8, "Password must be at least 8 characters");

export const loginPasswordSchema = z
  .string()
  .min(1, "Password is required")
  .min(6, "Password must be at least 6 characters");

export const indianMobileFieldSchema = z
  .string()
  .min(1, "Mobile number is required")
  .transform(normalizeIndianMobile)
  .refine((value) => INDIAN_MOBILE_REGEX.test(value), {
    message: "Enter a valid 10-digit Indian mobile number (starts with 6–9)",
  });

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: loginPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailFieldSchema,
});

export const registerSchema = z
  .object({
    fullName: z
      .string()
      .min(1, "Full name is required")
      .min(2, "Full name must be at least 2 characters"),
    email: emailFieldSchema,
    mobile: indianMobileFieldSchema,
    password: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export const resetPasswordSchema = z
  .object({
    token: z.string().min(1, "Reset token is required"),
    password: passwordFieldSchema,
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
