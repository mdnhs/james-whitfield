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
        // Mobile: bare avatars + two-line text (no pill), as in the mobile design.
        "inline-flex items-center gap-3 sm:gap-3.25 sm:rounded-[128px] sm:border sm:border-white/16 sm:bg-white/8 sm:py-1.75 sm:pr-5.75 sm:pl-1.75 sm:backdrop-blur-sm",
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
              "size-8 shrink-0 sm:size-14",
              i < avatars.length - 1 && "-mr-2.5 sm:-mr-2"
            )}
          />
        ))}
      </div>
      <p className="font-geist whitespace-nowrap text-white sm:text-xl sm:leading-[1.4] sm:tracking-[-0.4px]">
        <span
          data-hero="count"
          className="block text-[17px] leading-6 font-semibold tabular-nums sm:text-xl sm:leading-[1.4]"
          {...{ ...countAttrs(count), "data-motion": undefined }}
        >
          {statText(count)}
        </span>
        <span className="block text-[13px] leading-4.75 text-white/80 sm:text-xl sm:leading-[1.4]">
          {label}
        </span>
      </p>
    </div>
  )
}
