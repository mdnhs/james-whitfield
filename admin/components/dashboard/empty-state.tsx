import type { LucideIcon } from "lucide-react"

import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty"

// Empty states always say what will appear and, when there is one, offer
// the next step (docs/brief.md §9.4).
export function EmptyState({
  title,
  description,
  action,
  icon: Icon,
}: {
  title: string
  description: string
  action?: React.ReactNode
  icon?: LucideIcon
}) {
  return (
    <Empty className="rounded-card border border-dashed">
      <EmptyHeader>
        {Icon ? (
          <EmptyMedia variant="icon">
            <Icon />
          </EmptyMedia>
        ) : null}
        <EmptyTitle className="text-base font-semibold">{title}</EmptyTitle>
        <EmptyDescription>{description}</EmptyDescription>
      </EmptyHeader>
      {action ? <EmptyContent>{action}</EmptyContent> : null}
    </Empty>
  )
}
