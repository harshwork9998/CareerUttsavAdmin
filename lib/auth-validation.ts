import { z } from "zod";

import {
  INDIAN_MOBILE_ERROR,
  normalizeIndianMobileInput,
} from "@/lib/indian-mobile";

/** @deprecated Prefer normalizeIndianMobileInput from @/lib/indian-mobile */
export function normalizeIndianMobile(value: string): string {
  return normalizeIndianMobileInput(value) ?? "";
}

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
  .transform((value, ctx) => {
    const mobile = normalizeIndianMobileInput(value);
    if (!mobile) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: INDIAN_MOBILE_ERROR,
      });
      return z.NEVER;
    }
    return mobile;
  });

export const loginSchema = z.object({
  email: emailFieldSchema,
  password: loginPasswordSchema,
});

export const forgotPasswordSchema = z.object({
  email: emailFieldSchema,
});

/** Shared registration fields — used by client form and server API. */
export const registerFieldsSchema = z.object({
  fullName: z
    .string()
    .min(1, "Full name is required")
    .min(2, "Full name must be at least 2 characters"),
  email: emailFieldSchema,
  mobile: indianMobileFieldSchema,
  password: passwordFieldSchema,
});

/** Client-only: includes confirmPassword match validation. */
export const registerSchema = registerFieldsSchema
  .extend({
    confirmPassword: z.string().min(1, "Please confirm your password"),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

/** Server API: confirmPassword is validated client-side only. */
export const registerApiSchema = registerFieldsSchema;

const REGISTER_FIELD_ERRORS: Record<string, string> = {
  fullName: "Full name is required",
  email: "Please enter a valid email address",
  mobile: INDIAN_MOBILE_ERROR,
  password: "Password must be at least 8 characters",
};

/** Map Zod issues to safe user-facing registration errors. */
export function formatRegisterApiError(error: z.ZodError): string {
  const issue = error.issues[0];
  if (!issue) return "Invalid registration data";

  if (issue.message && issue.message !== "Invalid input") {
    return issue.message;
  }

  const field = String(issue.path[0] ?? "");
  return REGISTER_FIELD_ERRORS[field] ?? "Invalid registration data";
}

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

/** Server API: confirmPassword is validated client-side only. */
export const resetPasswordApiSchema = z.object({
  token: z.string().min(1, "Reset token is required"),
  password: passwordFieldSchema,
});

export type LoginFormValues = z.infer<typeof loginSchema>;
export type ForgotPasswordFormValues = z.infer<typeof forgotPasswordSchema>;
export type RegisterFormValues = z.infer<typeof registerSchema>;
export type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>;
