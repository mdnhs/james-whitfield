import { Icon } from "@/components/icons/icon"
import { cn } from "@/lib/utils"
import type { Credential } from "../data/credentials"

export function CredentialItem({
  credential,
  className,
}: {
  credential: Credential
  className?: string
}) {
  const { title, subtitle, icon } = credential

  return (
    <li className={cn("flex min-w-0 items-center gap-[12.682px]", className)}>
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
