import Link from "next/link";

import { BRAND } from "@/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = {
  title: `Sign In | ${BRAND.name} Admin`,
  description: `Sign in to the ${BRAND.name} admin panel`,
};

export default function LoginPage() {
  return (
    <div
      className="dash-apple relative flex min-h-screen flex-col items-center justify-center px-4 py-16 sm:py-20"
      style={{
        backgroundColor: "#F7F8FA",
        backgroundImage:
          "radial-gradient(ellipse 70% 45% at 50% 0%, rgba(31, 56, 100, 0.045), transparent 72%)",
      }}
    >
      <div className="flex w-[90%] max-w-[440px] flex-col items-center">
        <header className="mb-6 flex flex-col items-center text-center sm:mb-7">
          <BrandLogo variant="login" priority />
        </header>

        <LoginForm />

        <div className="mt-4 flex w-full justify-end">
          <Link
            href="/register"
            className="text-sm font-medium text-[#1F3864]/75 transition-colors hover:text-[#1F3864]"
          >
            New User?
          </Link>
        </div>
      </div>
    </div>
  );
}
