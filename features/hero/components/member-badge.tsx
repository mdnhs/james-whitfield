import Image from "next/image"

import { cn } from "@/lib/utils"
import { HERO_CONTENT } from "../data/hero-content"

export function MemberBadge({ className }: { className?: string }) {
  const { count, label, avatars } = HERO_CONTENT.members

  return (
    <div
      className={cn(
        "inline-flex items-center gap-3.25 rounded-[128px] border border-white/16 bg-white/8 py-1.75 pr-5.75 pl-1.75 backdrop-blur-sm",
        className
      )}
    >
      <div className="flex items-center">
        {avatars.map((src, i) => (
          <Image
            key={src}
            src={src}
            alt=""
            width={56}
            height={56}
            className={cn("size-14 shrink-0", i < avatars.length - 1 && "-mr-2")}
          />
        ))}
      </div>
      <p className="font-geist text-xl leading-[1.4] tracking-[-0.4px] whitespace-nowrap text-white">
        <span className="block font-semibold">{count}</span>
        <span className="block text-white/80">{label}</span>
      </p>
    </div>
  )
}
