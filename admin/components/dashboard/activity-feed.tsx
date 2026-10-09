import { initials } from "@/admin/lib/initials"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item"
import { ScrollArea } from "@/components/ui/scroll-area"

import { EmptyState } from "./empty-state"
import { relativeTime } from "./format"
import { StatusPill, type StatusTone } from "./status-pill"

export type ActivityEntry = {
  id: string
  name: string
  description: string
  at: string
  status?: { label: string; tone: StatusTone }
}

// The inspiration's "Team Collaboration" list as team activity.
export function ActivityFeed({
  entries,
  now,
  emptyTitle,
  emptyDescription,
  label = "Recent activity",
}: {
  entries: readonly ActivityEntry[]
  now: number
  emptyTitle: string
  emptyDescription: string
  // Names the scrollable list, which takes keyboard focus once it overflows
  // so it can be scrolled without a mouse.
  label?: string
}) {
  if (entries.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />
  }
  // Taller on phones, where descriptions wrap; the right padding keeps the
  // pills clear of the scrollbar.
  return (
    <ScrollArea
      className="max-h-130 sm:max-h-90"
      viewportProps={{ role: "region", "aria-label": label }}
    >
      <ItemGroup className="gap-1 pr-3">
        {entries.map((entry) => (
          <Item key={entry.id} role="listitem" size="sm" className="px-0">
            <ItemMedia>
              <Avatar className="size-10">
                <AvatarFallback className="bg-accent font-semibold text-accent-foreground">
                  {initials(entry.name)}
                </AvatarFallback>
              </Avatar>
            </ItemMedia>
            <ItemContent className="min-w-0">
              <ItemTitle>{entry.name}</ItemTitle>
              <ItemDescription>
                {entry.description} ·{" "}
                <time dateTime={entry.at}>{relativeTime(entry.at, now)}</time>
              </ItemDescription>
            </ItemContent>
            {entry.status ? (
              <ItemActions>
                <StatusPill tone={entry.status.tone}>
                  {entry.status.label}
                </StatusPill>
              </ItemActions>
            ) : null}
          </Item>
        ))}
      </ItemGroup>
    </ScrollArea>
  )
}
