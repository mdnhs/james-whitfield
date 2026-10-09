import type { BlockView } from "@/blocks/media-refs"
import { MediaImage } from "@/components/media-image"
import { countAttrs, statText } from "@/lib/count"
import { cn } from "@/lib/utils"

export function MemberBadge({
  members,
  className,
}: {
  members: BlockView<"hero.home">["members"]
  className?: string
}) {
  const { count, label, avatars } = members

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
        {avatars.map((avatar, i) => (
          <MediaImage
            key={i}
            media={avatar}
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
        <span
          data-hero="count"
          className="block font-semibold tabular-nums"
          {...{ ...countAttrs(count), "data-motion": undefined }}
        >
          {statText(count)}
        </span>
        <span className="block text-white/80">{label}</span>
      </p>
    </div>
  )
}
