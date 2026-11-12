import Image from "next/image"
import Link from "next/link"

import { servedAsIs, type MediaAsset } from "@/lib/media"

// The library logo (Appearance, Ruling R13) or today's mark. The seeded logo
// is the same file, so the default draws exactly what it drew before.
export function Brand({
  name,
  logo,
}: {
  name: string
  logo?: MediaAsset | null
}) {
  return (
    <Link href="/" className="flex items-center gap-2.5 lg:gap-3">
      <span className="relative flex size-10 shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint lg:size-12">
        <Image
          src={logo?.src ?? "/images/hero/logo-mark.svg"}
          alt=""
          width={28}
          height={28}
          unoptimized={logo ? servedAsIs(logo.src) : undefined}
          className={logo ? "size-7 object-contain" : undefined}
        />
      </span>
      <span className="font-geist text-[17px] leading-6 font-semibold whitespace-nowrap text-white lg:text-xl lg:leading-[normal]">
        {name}
      </span>
    </Link>
  )
}
