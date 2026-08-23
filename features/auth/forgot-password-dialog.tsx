"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion } from "framer-motion";
import { Mail } from "lucide-react";

import {
  AuthFormAlert,
  AuthFormField,
  AuthPrimaryButton,
  AuthTextInput,
} from "@/features/auth/auth-form-primitives";
import {
  forgotPasswordSchema,
  type ForgotPasswordFormValues,
} from "@/lib/auth-validation";
import { forgotPassword } from "@/services/auth-service";
import type { AuthFormStatus } from "@/types/auth";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface ForgotPasswordDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function ForgotPasswordDialog({
  open,
  onOpenChange,
}: ForgotPasswordDialogProps) {
  const [status, setStatus] = useState<AuthFormStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ForgotPasswordFormValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  useEffect(() => {
    if (!open) {
      reset({ email: "" });
      setStatus("idle");
      setFeedbackMessage(null);
    }
  }, [open, reset]);

  const onSubmit = async (values: ForgotPasswordFormValues) => {
    setStatus("loading");
    setFeedbackMessage(null);

    const result = await forgotPassword({ email: values.email.trim() });

    if (result.success) {
      setStatus("success");
      setFeedbackMessage(
        result.message ??
          "If an account exists for this email, a password reset link has been sent."
      );
      return;
    }

    setStatus("error");
    setFeedbackMessage(result.error ?? "Unable to send reset link. Please try again.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px] gap-0 rounded-[18px] border-[#E8EAED] p-0 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)]">
        <div className="px-7 py-7 sm:px-9 sm:py-8">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-bold text-[#1F3864]">
              Forgot password
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Enter your email and we&apos;ll send you a link to reset your password.
            </DialogDescription>
          </DialogHeader>

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
                <AuthPrimaryButton
                  type="button"
                  onClick={() => onOpenChange(false)}
                >
                  Back to sign in
                </AuthPrimaryButton>
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

                <AuthFormField
                  id="forgot-email"
                  label="Email address"
                  icon={Mail}
                  error={errors.email?.message}
                >
                  <AuthTextInput
                    id="forgot-email"
                    type="email"
                    autoComplete="email"
                    invalid={Boolean(errors.email)}
                    aria-describedby={
                      errors.email ? "forgot-email-error" : undefined
                    }
                    {...register("email")}
                  />
                </AuthFormField>

                <AuthPrimaryButton
                  loading={status === "loading"}
                  loadingLabel="Sending..."
                >
                  Send Reset Link
                </AuthPrimaryButton>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}
