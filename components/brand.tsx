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
      {logo ? (
        // An uploaded logo stands on its own: no badge behind it, at the size
        // the badge took up, so its own artwork carries the brand.
        <Image
          src={logo.src}
          alt=""
          width={64}
          height={64}
          unoptimized={servedAsIs(logo.src)}
          className="size-12 shrink-0 object-contain lg:size-16"
        />
      ) : (
        <span className="relative flex size-10 shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint lg:size-12">
          <Image
            src="/images/hero/logo-mark.svg"
            alt=""
            width={28}
            height={28}
          />
        </span>
      )}
      <span className="font-geist text-[17px] leading-6 font-semibold whitespace-nowrap text-white lg:text-xl lg:leading-[normal]">
        {name}
      </span>
    </Link>
  )
}
