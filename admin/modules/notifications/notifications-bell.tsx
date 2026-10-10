"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { BellIcon } from "lucide-react"
import Link from "next/link"
import { useState } from "react"

import { relativeTime } from "@/admin/components/dashboard/format"
import { notificationsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import { badgeText, type NotificationsDto } from "@/lib/notifications"
import { cn } from "@/lib/utils"

import { notificationsQuery } from "./queries"

// The bell (docs/brief.md §9.1). Opening it marks everything read for this
// person; what was new at that moment stays marked until it closes.
export function NotificationsBell({ className }: { className?: string }) {
  const client = useQueryClient()
  const { data, dataUpdatedAt } = useQuery(notificationsQuery())
  const [fresh, setFresh] = useState<ReadonlySet<string>>(new Set())
  const seen = useMutation({
    mutationFn: () => parseResponse(notificationsApi.seen.$post()),
    onSuccess: ({ seenAt }) =>
      client.setQueryData<NotificationsDto>(
        queryKeys.notifications,
        (old) =>
          old && {
            seenAt,
            unread: 0,
            items: old.items.map((item) => ({ ...item, unread: false })),
          }
      ),
    // View-as refuses (Ruling R9): nothing to undo.
    onError: () => {},
  })
  const unread = data?.unread ?? 0

  function onOpenChange(open: boolean) {
    if (!open) return
    setFresh(
      new Set(data?.items.filter((item) => item.unread).map((item) => item.id))
    )
    if (unread > 0) seen.mutate()
  }

  return (
    <Popover onOpenChange={onOpenChange}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            size="icon-lg"
            className={cn("relative", className)}
            aria-label={
              unread
                ? `Notifications (${badgeText(unread)} unread)`
                : "Notifications"
            }
          />
        }
      >
        <BellIcon />
        {unread ? (
          <span
            aria-hidden
            className="absolute -top-1 -right-1 min-w-5 rounded-full bg-primary px-1 text-center text-[11px] leading-5 font-semibold text-primary-foreground"
          >
            {badgeText(unread)}
          </span>
        ) : null}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 gap-0 p-0">
        <PopoverHeader className="border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
        </PopoverHeader>
        <ScrollArea className="max-h-80">
          {data?.items.length ? (
            <ul aria-label="Notifications" className="flex flex-col py-1">
              {data.items.map((item) => (
                <li key={item.id}>
                  <Link
                    href={item.href}
                    className="flex flex-col gap-0.5 px-4 py-2.5 text-sm hover:bg-muted focus-visible:bg-muted focus-visible:outline-none"
                  >
                    <span className="flex items-center gap-2 font-medium">
                      {fresh.has(item.id) ? (
                        <span
                          aria-hidden
                          className="size-2 shrink-0 rounded-full bg-primary"
                        />
                      ) : null}
                      {item.title}
                      {fresh.has(item.id) ? (
                        <span className="sr-only"> (new)</span>
                      ) : null}
                    </span>
                    <span className="text-muted-foreground">
                      {item.description}
                    </span>
                    <time
                      dateTime={item.at}
                      className="text-xs text-muted-foreground"
                    >
                      {relativeTime(item.at, dataUpdatedAt)}
                    </time>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              You&apos;re all caught up. New enquiries, posts going live and
              failed deliveries will show here.
            </p>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  )
}
