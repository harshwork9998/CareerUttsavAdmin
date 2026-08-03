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
        <h1 className="mb-6 whitespace-nowrap text-center text-[clamp(1.35rem,4.2vw,3rem)] font-bold leading-none tracking-tight text-[#1F3864] sm:mb-8">
          Behind the scenes starts here.
        </h1>

        <div className="flex w-[90%] max-w-[440px] flex-col">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}
