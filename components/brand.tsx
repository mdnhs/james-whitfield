import Link from "next/link"

import { LogoMark } from "@/components/logo-mark"
import { NO_BRAND_LOGO, type BrandLogo } from "@/lib/brand"

// The site's logo (Appearance, Ruling R13) with its name, for the header and
// footer. With nothing uploaded it draws today's mark on its mint badge.
export function Brand({
  name,
  logo = NO_BRAND_LOGO,
}: {
  name: string
  logo?: BrandLogo
}) {
  return (
    <Link href="/" className="flex items-center gap-2.5 lg:gap-3">
      <LogoMark
        logo={logo}
        className="size-12 lg:size-16"
        badgeClassName="size-10 lg:size-12"
      />
      <span className="font-geist text-[17px] leading-6 font-semibold whitespace-nowrap text-white lg:text-xl lg:leading-[normal]">
        {name}
      </span>
    </Link>
  )
}
