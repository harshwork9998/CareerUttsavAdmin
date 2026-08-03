import { BRAND } from "@/constants";
import { cn } from "@/lib/utils";

const VARIANTS = {
  icon: "h-12 w-12 object-contain object-center",
  sidebar: "h-16 w-full max-w-[232px] object-contain object-center",
  login: "h-[4.5rem] w-auto max-w-[280px] object-contain sm:h-24 sm:max-w-[320px]",
} as const;

export type BrandLogoVariant = keyof typeof VARIANTS;

export interface BrandLogoProps {
  variant?: BrandLogoVariant;
  className?: string;
  priority?: boolean;
}

/** Plain img — Next/Image optimization can flatten PNG transparency to black. */
export function BrandLogo({
  variant = "sidebar",
  className,
  priority = false,
}: BrandLogoProps) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={BRAND.logo}
      alt={`${BRAND.name} logo`}
      decoding="async"
      loading={priority ? "eager" : "lazy"}
      className={cn(VARIANTS[variant], className)}
    />
  );
}
