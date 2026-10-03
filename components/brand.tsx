import Image from "next/image"
import Link from "next/link"

export function Brand() {
  return (
    <Link href="/" className="flex items-center gap-3">
      <span className="relative flex size-12 shrink-0 items-center justify-center overflow-clip rounded-full bg-brand-mint">
        <Image src="/images/hero/logo-mark.svg" alt="" width={28} height={28} />
      </span>
      <span className="font-geist text-xl leading-[normal] font-semibold whitespace-nowrap text-white">
        James Whitfield
      </span>
    </Link>
  )
}
