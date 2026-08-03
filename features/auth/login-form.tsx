"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { Eye, EyeOff, Loader2, Lock, Mail } from "lucide-react";
import { toast } from "sonner";

import { useAuthStore } from "@/store/auth-store";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const loginSchema = z.object({
  email: z
    .string()
    .min(1, "Email is required")
    .email("Please enter a valid email address"),
  password: z
    .string()
    .min(1, "Password is required")
    .min(6, "Password must be at least 6 characters"),
});

type LoginFormValues = z.infer<typeof loginSchema>;

const inputStyles = cn(
  "h-[46px] rounded-[11px] border-[#E2E5EB] bg-white pl-10 pr-10 text-sm shadow-none",
  "transition-[border-color,box-shadow] duration-200 ease-out",
  "focus-visible:border-[#1F3864] focus-visible:ring-0 focus-visible:outline-none",
  "focus-visible:shadow-[0_0_0_3px_rgba(31,56,100,0.1)]"
);

function FieldShell({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "relative transition-transform duration-200 ease-out focus-within:scale-[1.008]",
        className
      )}
    >
      {children}
    </div>
  );
}

export function LoginForm() {
  const router = useRouter();
  const login = useAuthStore((s) => s.login);
  const [showPassword, setShowPassword] = useState(false);

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
      router.push("/dashboard");
      return;
    }

    toast.error("Sign in failed", {
      description: result.error ?? "Invalid credentials",
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      className={cn(
        "w-full rounded-[18px] border border-[#E8EAED] bg-white",
        "px-7 py-7 sm:px-9 sm:py-8",
        "shadow-[0_1px_2px_rgba(16,24,40,0.04),0_6px_20px_rgba(16,24,40,0.05)]"
      )}
    >
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </Label>
          <FieldShell>
            <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/55" />
            <Input
              id="email"
              type="email"
              autoComplete="email"
              className={inputStyles}
              {...register("email")}
            />
          </FieldShell>
          {errors.email && (
            <p className="text-xs text-destructive">{errors.email.message}</p>
          )}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </Label>
          <FieldShell>
            <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-[18px] w-[18px] -translate-y-1/2 text-muted-foreground/55" />
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className={inputStyles}
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
          </FieldShell>
          <div className="flex justify-end pt-0.5">
            <Link
              href="/forgot-password"
              className="text-xs font-medium text-[#1F3864]/75 transition-colors hover:text-[#1F3864]"
            >
              Forgot password?
            </Link>
          </div>
          {errors.password && (
            <p className="text-xs text-destructive">{errors.password.message}</p>
          )}
        </div>

        <motion.div
          whileHover={{ y: -1 }}
          whileTap={{ y: 0 }}
          transition={{ duration: 0.18, ease: "easeOut" }}
        >
          <Button
            type="submit"
            disabled={isSubmitting}
            className={cn(
              "h-[46px] w-full rounded-[11px] text-sm font-medium text-white",
              "bg-[#1F3864] shadow-none transition-colors duration-200",
              "hover:bg-[#182E52] hover:shadow-[0_4px_12px_rgba(31,56,100,0.18)]"
            )}
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Signing in...
              </>
            ) : (
              "Sign in"
            )}
          </Button>
        </motion.div>
      </form>
    </motion.div>
  );
}
