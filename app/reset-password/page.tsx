import { Suspense } from "react";

import { BRAND } from "@/constants";
import { BrandLogo } from "@/components/shared/brand-logo";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata = {
  title: `Reset Password | ${BRAND.name} Admin`,
  description: `Reset your ${BRAND.name} admin password`,
};

export default function ResetPasswordPage() {
  return (
    <div
      className="dash-apple relative min-h-screen"
      style={{
        backgroundColor: "#F0C8C4",
        backgroundImage:
          "radial-gradient(ellipse 80% 55% at 50% 0%, rgba(190, 38, 32, 0.38), transparent 68%), linear-gradient(180deg, #F8E2DF 0%, #E8B0AA 100%)",
      }}
    >
      <div className="absolute left-5 top-5 z-10 sm:left-8 sm:top-8">
        <BrandLogo
          variant="login"
          priority
          className="h-12 max-w-[200px] sm:h-14 sm:max-w-[240px]"
        />
      </div>

      <div className="flex min-h-screen flex-col items-center justify-center px-4 py-20 sm:py-24">
        <div className="flex w-[90%] max-w-[440px] flex-col">
          <Suspense fallback={<div className="h-64 rounded-[18px] bg-white/80" />}>
            <ResetPasswordForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
