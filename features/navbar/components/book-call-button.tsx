import Image from "next/image"
import Link from "next/link"

import { cn } from "@/lib/utils"
import { BOOK_CALL_HREF } from "../data/nav-links"

export function BookCallButton({ className }: { className?: string }) {
  return (
    <Link
      href={BOOK_CALL_HREF}
      className={cn(
        "group inline-flex h-11.5 items-center gap-5 rounded-full border border-[#9a9a9a] pr-1.25 pl-5.75 transition-colors hover:border-white hover:bg-white/10",
        className
      )}
    >
      <span className="text-lg leading-7 font-medium tracking-[0.18px] whitespace-nowrap text-cream capitalize">
        Book a Call
      </span>
      <Image
        src="/images/hero/arrow-circle.svg"
        alt=""
        width={34}
        height={34}
        className="transition-transform group-hover:rotate-45"
      />
    </Link>
  )
}
