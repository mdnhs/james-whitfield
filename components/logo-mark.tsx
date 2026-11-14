import Image from "next/image"

import { LottieLogo } from "@/components/lottie-logo"
import type { BrandLogo } from "@/lib/brand"
import { servedAsIs } from "@/lib/media"
import { cn } from "@/lib/utils"

// The site's logo wherever the site shows it: the Lottie animation while it
// is switched on, else the uploaded logo on its own, else the built-in mark
// on its mint badge. `className` sizes the logo, `badgeClassName` the badge.
export function LogoMark({
  logo,
  className,
  badgeClassName,
}: {
  logo: BrandLogo
  className: string
  badgeClassName: string
}) {
  const still = logo.image ? (
    <Image
      src={logo.image.src}
      alt=""
      width={64}
      height={64}
      unoptimized={servedAsIs(logo.image.src)}
      className={cn("shrink-0 object-contain", className)}
    />
  ) : (
    <span
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint",
        badgeClassName
      )}
    >
      <Image src="/images/hero/logo-mark.svg" alt="" width={28} height={28} />
    </span>
  )
  if (!logo.lottie) return still
  return (
    <LottieLogo src={logo.lottie.src} className={className}>
      {still}
    </LottieLogo>
  )
}
