import { Icon } from "@/components/icons/icon"
import type { BlockView } from "@/blocks/media-refs"

export function CredentialItem({
  badge,
}: {
  badge: BlockView<"credibility">["badges"][number]
}) {
  const { title, subtitle, icon } = badge

  return (
    // Mobile: stacked sage card (icon above text); sm+: inline row.
    <li className="flex min-w-0 flex-col items-start gap-3 rounded-2xl bg-stone p-4 sm:flex-row sm:items-center sm:gap-[12.682px] sm:rounded-none sm:bg-transparent sm:p-0">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[12.682px] bg-mist sm:size-[42.273px] sm:bg-[#cee9da]">
        <Icon name={icon} className="text-spruce" />
      </span>
      <span className="flex flex-col gap-0.5 font-geist sm:gap-0 sm:font-jakarta sm:whitespace-nowrap">
        <span className="text-[17px] leading-6 font-semibold text-pine sm:text-[14.795px] sm:leading-[21.136px] sm:tracking-[0.2959px] sm:text-spruce">
          {title}
        </span>
        <span className="text-[13px] leading-4.75 text-[#686561] sm:text-[12.682px] sm:leading-[19.023px] sm:font-medium sm:tracking-[0.1268px] sm:text-[#414846]">
          {subtitle}
        </span>
      </span>
    </li>
  )
}
