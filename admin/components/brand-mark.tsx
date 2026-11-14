import { LogoMark } from "@/components/logo-mark"
import { NO_BRAND_LOGO, type BrandLogo } from "@/lib/brand"
import { cn } from "@/lib/utils"

export type AdminBrand = { name: string; logo: BrandLogo }

// The site's own logo (Identity) and name, sized for admin chrome: the
// Lottie while it is on, else the uploaded logo, else the built-in mark.
export function BrandMark({
  brand = { name: "", logo: NO_BRAND_LOGO },
  tone = "default",
  className,
}: {
  brand?: AdminBrand
  tone?: "default" | "inverse"
  className?: string
}) {
  const inverse = tone === "inverse"
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <LogoMark
        logo={brand.logo}
        className="size-10"
        badgeClassName={cn("size-10", inverse ? "bg-white/90" : "bg-accent")}
      />
      <span className="flex items-center gap-2">
        {brand.name ? (
          <span className="text-base font-semibold tracking-tight">
            {brand.name}
          </span>
        ) : null}
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
            inverse
              ? "bg-white/15 text-white"
              : "bg-accent text-accent-foreground"
          )}
        >
          Admin
        </span>
      </span>
    </span>
  )
}
