import { Icon } from "@/components/icons/icon"
import type { BlockView } from "@/blocks/media-refs"

export function CredentialItem({
  badge,
}: {
  badge: BlockView<"credibility">["badges"][number]
}) {
  const { title, subtitle, icon } = badge

  return (
    <li className="flex min-w-0 items-center gap-[12.682px]">
      <span className="flex size-[42.273px] shrink-0 items-center justify-center rounded-[12.682px] bg-[#cee9da]">
        <Icon name={icon} className="text-spruce" />
      </span>
      <span className="flex flex-col font-jakarta whitespace-nowrap">
        <span className="text-[14.795px] leading-[21.136px] font-semibold tracking-[0.2959px] text-spruce">
          {title}
        </span>
        <span className="text-[12.682px] leading-[19.023px] font-medium tracking-[0.1268px] text-[#414846]">
          {subtitle}
        </span>
      </span>
    </li>
  )
}
