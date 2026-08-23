"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Lock } from "lucide-react";

import {
  AuthFormAlert,
  AuthFormField,
  AuthPrimaryButton,
  AuthTextInput,
} from "@/features/auth/auth-form-primitives";
import {
  resetPasswordSchema,
  type ResetPasswordFormValues,
} from "@/lib/auth-validation";
import { resetPassword } from "@/services/auth-service";
import type { AuthFormStatus } from "@/types/auth";
import { Button } from "@/components/ui/button";

const INVALID_RESET_LINK_UI_MESSAGE =
  "This reset link is invalid or has expired.";

function isInvalidResetLinkError(message: string | undefined): boolean {
  return Boolean(message?.includes("invalid or has expired"));
}

export function ResetPasswordForm() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token") ?? "";
  const [status, setStatus] = useState<AuthFormStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [invalidLink, setInvalidLink] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors },
  } = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: {
      token: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (token) {
      setValue("token", token);
    }
  }, [token, setValue]);

  const onSubmit = async (values: ResetPasswordFormValues) => {
    setStatus("loading");
    setFeedbackMessage(null);

    const result = await resetPassword({
      token: values.token,
      password: values.password,
      confirmPassword: values.confirmPassword,
    });

    if (result.success) {
      setStatus("success");
      setFeedbackMessage(
        result.message ?? "Your password has been reset successfully. You can now sign in."
      );
      return;
    }

    setStatus("error");
    const errorMessage =
      result.error ?? "Unable to reset password. Please try again.";
    if (isInvalidResetLinkError(errorMessage)) {
      setInvalidLink(true);
      setFeedbackMessage(INVALID_RESET_LINK_UI_MESSAGE);
      return;
    }
    setFeedbackMessage(errorMessage);
  };

  if (!token || invalidLink) {
    return (
      <div className="rounded-[18px] border border-[#E8EAED] bg-white px-7 py-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)] sm:px-9 sm:py-8">
        <AuthFormAlert
          variant="error"
          message={INVALID_RESET_LINK_UI_MESSAGE}
        />
        <Button asChild className="mt-4 w-full">
          <Link href="/login">Request a New Reset Link</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-[18px] border border-[#E8EAED] bg-white px-7 py-7 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)] sm:px-9 sm:py-8">
      <div className="space-y-2 text-left">
        <h1 className="text-xl font-bold text-[#1F3864]">Reset password</h1>
        <p className="text-sm text-muted-foreground">
          Choose a new password for your Career Uttsav Admin account.
        </p>
      </div>

      <AnimatePresence mode="wait">
        {status === "success" ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            className="mt-6 space-y-4"
          >
            <AuthFormAlert variant="success" message={feedbackMessage ?? ""} />
            <Button asChild className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onSubmit={handleSubmit(onSubmit)}
            className="mt-6 space-y-4"
            noValidate
          >
            {status === "error" && feedbackMessage ? (
              <AuthFormAlert variant="error" message={feedbackMessage} />
            ) : null}

            <input type="hidden" {...register("token")} />

            <AuthFormField
              id="reset-password"
              label="New Password"
              icon={Lock}
              error={errors.password?.message}
            >
              <AuthTextInput
                id="reset-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.password)}
                {...register("password")}
              />
            </AuthFormField>

            <AuthFormField
              id="reset-confirm-password"
              label="Confirm New Password"
              icon={Lock}
              error={errors.confirmPassword?.message}
            >
              <AuthTextInput
                id="reset-confirm-password"
                type="password"
                autoComplete="new-password"
                invalid={Boolean(errors.confirmPassword)}
                {...register("confirmPassword")}
              />
            </AuthFormField>

            <AuthPrimaryButton
              loading={status === "loading"}
              loadingLabel="Resetting password..."
            >
              Reset Password
            </AuthPrimaryButton>

            <Button asChild variant="ghost" className="w-full">
              <Link href="/login">Back to sign in</Link>
            </Button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  );
}
