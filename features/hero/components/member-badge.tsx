import Image from "next/image"

import { cn } from "@/lib/utils"
import { HERO_CONTENT } from "../data/hero-content"

export function MemberBadge({ className }: { className?: string }) {
  const { count, label, avatars } = HERO_CONTENT.members

  return (
    <div
      data-hero="badge"
      data-reveal
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
            data-hero="avatar"
            className={cn(
              "size-12 shrink-0 sm:size-14",
              i < avatars.length - 1 && "-mr-2"
            )}
          />
        ))}
      </div>
      <p className="font-geist text-lg leading-[1.4] tracking-[-0.4px] whitespace-nowrap text-white sm:text-xl">
        <span data-hero="count" className="block font-semibold tabular-nums">
          {count}
        </span>
        <span className="block text-white/80">{label}</span>
      </p>
    </div>
  )
}
