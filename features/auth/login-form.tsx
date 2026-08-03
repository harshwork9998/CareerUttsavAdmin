"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import {
  AUTH_CARD_CLASS,
  AUTH_LINK_CLASS,
  AUTH_SECONDARY_BUTTON_CLASS,
  AuthFormField,
  AuthPrimaryButton,
  AuthTextInput,
} from "@/features/auth/auth-form-primitives";
import { ForgotPasswordDialog } from "@/features/auth/forgot-password-dialog";
import { RegisterDialog } from "@/features/auth/register-dialog";
import { loginSchema, type LoginFormValues } from "@/lib/auth-validation";
import { getDefaultRouteForRole } from "@/lib/access-control";
import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);
  const [forgotOpen, setForgotOpen] = useState(false);
  const [registerOpen, setRegisterOpen] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const onSubmit = async (values: LoginFormValues) => {
    const result = await login(values.email, values.password, false);

    if (result.success) {
      const role = useAuthStore.getState().user?.role ?? "user";
      router.push(getDefaultRouteForRole(role));
      return;
    }

    toast.error("Sign in failed", {
      description: result.error ?? "Invalid credentials",
    });
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className={AUTH_CARD_CLASS}
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <AuthFormField
            id="email"
            label="Email"
            icon={Mail}
            error={errors.email?.message}
          >
            <AuthTextInput
              id="email"
              type="email"
              autoComplete="email"
              invalid={Boolean(errors.email)}
              {...register("email")}
            />
          </AuthFormField>

          <AuthFormField
            id="password"
            label="Password"
            icon={Lock}
            error={errors.password?.message}
          >
            <AuthTextInput
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              invalid={Boolean(errors.password)}
              {...register("password")}
            />
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="absolute right-1 top-1/2 h-9 w-9 -translate-y-1/2 text-muted-foreground/55 hover:bg-transparent hover:text-muted-foreground"
              onClick={() => setShowPassword((prev) => !prev)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? (
                <EyeOff className="h-[18px] w-[18px]" />
              ) : (
                <Eye className="h-[18px] w-[18px]" />
              )}
            </Button>
          </AuthFormField>

          <div className="-mt-1 flex justify-end">
            <button
              type="button"
              className={AUTH_LINK_CLASS}
              onClick={() => setForgotOpen(true)}
            >
              Forgot password?
            </button>
          </div>

          <motion.div
            whileHover={{ y: -1 }}
            whileTap={{ y: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
          >
            <AuthPrimaryButton loading={isSubmitting} loadingLabel="Signing in...">
              Sign in
            </AuthPrimaryButton>
          </motion.div>

          <Button
            type="button"
            variant="outline"
            className={cn(AUTH_SECONDARY_BUTTON_CLASS, "mt-1")}
            onClick={() => setRegisterOpen(true)}
          >
            Create Account
          </Button>
        </form>
      </motion.div>

      <ForgotPasswordDialog open={forgotOpen} onOpenChange={setForgotOpen} />
      <RegisterDialog open={registerOpen} onOpenChange={setRegisterOpen} />
    </>
  );
}
