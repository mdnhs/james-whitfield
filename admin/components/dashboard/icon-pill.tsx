import type { LucideIcon } from "lucide-react"

import { cn } from "@/lib/utils"

import { StatusPill, type StatusTone } from "./status-pill"

// A status value as a small pill led by its icon (lead status, a chat's
// state, a subscriber, a role, two-factor on/off).
export function IconPill({
  tone,
  icon: Icon,
  children,
  className,
}: {
  tone: StatusTone
  icon: LucideIcon
  children: React.ReactNode
  className?: string
}) {
  return (
    <StatusPill
      tone={tone}
      className={cn("h-6 gap-1 px-2.5 [&_svg]:size-3.5", className)}
    >
      <Icon aria-hidden />
      {children}
    </StatusPill>
  )
}
