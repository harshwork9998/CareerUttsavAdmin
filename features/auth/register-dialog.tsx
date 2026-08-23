"use client";

import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQueryClient } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail, Phone, User } from "lucide-react";

import {
  AuthFormAlert,
  AuthFormField,
  AuthPrimaryButton,
  AuthTextInput,
} from "@/features/auth/auth-form-primitives";
import {
  registerSchema,
  type RegisterFormValues,
} from "@/lib/auth-validation";
import { register as registerAccount } from "@/services/auth-service";
import type { AuthFormStatus } from "@/types/auth";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface RegisterDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function RegisterDialog({ open, onOpenChange }: RegisterDialogProps) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<AuthFormStatus>("idle");
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<RegisterFormValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      fullName: "",
      email: "",
      mobile: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    if (!open) {
      reset({
        fullName: "",
        email: "",
        mobile: "",
        password: "",
        confirmPassword: "",
      });
      setStatus("idle");
      setFeedbackMessage(null);
      setShowPassword(false);
      setShowConfirmPassword(false);
    }
  }, [open, reset]);

  const onSubmit = async (values: RegisterFormValues) => {
    setStatus("loading");
    setFeedbackMessage(null);

    const result = await registerAccount({
      fullName: values.fullName.trim(),
      email: values.email.trim(),
      mobile: values.mobile,
      password: values.password,
    });

    if (result.success) {
      setStatus("success");
      setFeedbackMessage(
        result.message ??
          "Account created successfully. Awaiting administrator approval."
      );
      queryClient.invalidateQueries({ queryKey: ["users"] });
      return;
    }

    setStatus("error");
    setFeedbackMessage(result.error ?? "Unable to create account. Please try again.");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-[440px] gap-0 overflow-y-auto rounded-[18px] border-[#E8EAED] p-0 shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)]">
        <div className="px-7 py-7 sm:px-9 sm:py-8">
          <DialogHeader className="space-y-2 text-left">
            <DialogTitle className="text-xl font-bold text-[#1F3864]">
              Create account
            </DialogTitle>
            <DialogDescription className="text-sm text-muted-foreground">
              Submit your details for review. A superuser will approve your access
              and assign the appropriate role.
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
                  id="register-fullName"
                  label="Full Name"
                  icon={User}
                  error={errors.fullName?.message}
                >
                  <AuthTextInput
                    id="register-fullName"
                    type="text"
                    autoComplete="name"
                    invalid={Boolean(errors.fullName)}
                    {...register("fullName")}
                  />
                </AuthFormField>

                <AuthFormField
                  id="register-email"
                  label="Email"
                  icon={Mail}
                  error={errors.email?.message}
                >
                  <AuthTextInput
                    id="register-email"
                    type="email"
                    autoComplete="email"
                    invalid={Boolean(errors.email)}
                    {...register("email")}
                  />
                </AuthFormField>

                <AuthFormField
                  id="register-mobile"
                  label="Mobile Number"
                  icon={Phone}
                  error={errors.mobile?.message}
                >
                  <AuthTextInput
                    id="register-mobile"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="10-digit mobile number"
                    invalid={Boolean(errors.mobile)}
                    {...register("mobile")}
                  />
                </AuthFormField>

                <AuthFormField
                  id="register-password"
                  label="Password"
                  icon={Lock}
                  error={errors.password?.message}
                >
                  <AuthTextInput
                    id="register-password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    invalid={Boolean(errors.password)}
                    {...register("password")}
                  />
                  <PasswordToggle
                    visible={showPassword}
                    onToggle={() => setShowPassword((prev) => !prev)}
                    label={showPassword ? "Hide password" : "Show password"}
                  />
                </AuthFormField>

                <AuthFormField
                  id="register-confirmPassword"
                  label="Confirm Password"
                  icon={Lock}
                  error={errors.confirmPassword?.message}
                >
                  <AuthTextInput
                    id="register-confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    autoComplete="new-password"
                    invalid={Boolean(errors.confirmPassword)}
                    {...register("confirmPassword")}
                  />
                  <PasswordToggle
                    visible={showConfirmPassword}
                    onToggle={() => setShowConfirmPassword((prev) => !prev)}
                    label={
                      showConfirmPassword
                        ? "Hide confirm password"
                        : "Show confirm password"
                    }
                  />
                </AuthFormField>

                <AuthPrimaryButton
                  loading={status === "loading"}
                  loadingLabel="Creating account..."
                >
                  Create Account
                </AuthPrimaryButton>
              </motion.form>
            )}
          </AnimatePresence>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function PasswordToggle({
  visible,
  onToggle,
  label,
}: {
  visible: boolean;
  onToggle: () => void;
  label: string;
}) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground/55 hover:bg-transparent hover:text-muted-foreground"
      onClick={onToggle}
      aria-label={label}
    >
      {visible ? (
        <EyeOff className="h-[18px] w-[18px]" />
      ) : (
        <Eye className="h-[18px] w-[18px]" />
      )}
    </Button>
  );
}
