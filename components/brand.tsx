import Image from "next/image"
import Link from "next/link"

import type { MediaAsset } from "@/lib/media"

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
    <Link href="/" className="flex items-center gap-3">
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint">
        <Image
          src={logo?.src ?? "/images/hero/logo-mark.svg"}
          alt=""
          width={28}
          height={28}
          className={logo ? "size-7 object-contain" : undefined}
        />
      </span>
      <span className="font-geist text-xl leading-[normal] font-semibold whitespace-nowrap text-white">
        {name}
      </span>
    </Link>
  )
}
