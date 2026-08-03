import { BRAND } from "@/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { LoginForm } from "@/features/auth/login-form";

export const metadata = {
  title: `Sign In | ${BRAND.name} Admin`,
  description: `Sign in to the ${BRAND.name} admin panel`,
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-4 py-12">
      {/* Background */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-[#1F3864] via-[#1F3864]/95 to-[#0E7C7B]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-30"
        style={{
          backgroundImage:
            "radial-gradient(circle at 20% 80%, rgba(14,124,123,0.4) 0%, transparent 50%), radial-gradient(circle at 80% 20%, rgba(59,130,246,0.2) 0%, transparent 40%)",
        }}
        aria-hidden
      />

      <div className="relative z-10 w-full max-w-md space-y-8">
        {/* Branding */}
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center px-4 py-3">
            <BrandLogo variant="login" priority />
          </div>
          <h1 className="sr-only">{BRAND.name} Admin Portal</h1>
          <p className="text-sm text-white/70">{BRAND.org} Admin Portal</p>
        </div>

        <LoginForm />

        <p className="text-center text-xs text-white/50">
          &copy; {new Date().getFullYear()} {BRAND.org}. All rights reserved.
        </p>
      </div>
    </div>
  );
}
