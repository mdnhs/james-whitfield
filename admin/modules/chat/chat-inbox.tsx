"use client"

import { useInfiniteQuery, useQuery } from "@tanstack/react-query"
import { MessagesSquareIcon } from "lucide-react"
import { parseAsString, parseAsStringLiteral, useQueryStates } from "nuqs"
import { useEffect } from "react"

import { EmptyState } from "@/admin/components/dashboard/empty-state"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { useActor } from "@/admin/lib/actor-context"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { cn } from "@/lib/utils"

import { ChatThread } from "./chat-thread"
import { formatMessageTime, useTabVisible } from "./present"
import { type ChatListItem, chatListQuery, chatUnreadQuery } from "./queries"

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

const params = {
  c: parseAsString,
  status: parseAsStringLiteral(["open", "closed"] as const).withDefault("open"),
}

function Row({
  chat,
  selected,
  mine,
  onSelect,
}: {
  chat: ChatListItem
  selected: boolean
  mine: boolean
  onSelect(): void
}) {
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? "true" : undefined}
        className={cn(
          "flex w-full flex-col gap-1 border-b px-3 py-2.5 text-left hover:bg-muted/60",
          selected && "bg-muted"
        )}
      >
        <span className="flex items-center gap-2">
          {chat.unread ? (
            <span
              role="img"
              aria-label="Unread"
              className="size-2 shrink-0 rounded-full bg-primary"
            />
          ) : null}
          <span
            className={cn(
              "min-w-0 flex-1 truncate text-sm",
              chat.unread ? "font-semibold" : "font-medium"
            )}
          >
            {chat.visitorName}
          </span>
          <time
            dateTime={chat.lastMessageAt}
            className="shrink-0 text-xs text-muted-foreground"
          >
            {formatMessageTime(chat.lastMessageAt)}
          </time>
        </span>
        <span className="flex flex-wrap gap-1">
          {chat.needsHuman ? (
            <Badge variant="destructive">Needs a person</Badge>
          ) : null}
          {chat.status === "open" && chat.aiEnabled ? (
            <Badge variant="secondary">AI</Badge>
          ) : null}
          {chat.assignedTo ? (
            <Badge variant="outline">
              {mine ? "Assigned to you" : "Assigned"}
            </Badge>
          ) : null}
        </span>
      </button>
    </li>
  )
}

export function ChatInbox() {
  const visible = useTabVisible()
  const { user } = useActor()
  const [{ c, status }, setState] = useQueryStates(params, {
    history: "replace",
  })
  const selected = c && UUID.test(c) ? c.toLowerCase() : null
  const list = useInfiniteQuery(chatListQuery(status, visible))
  const unread = useQuery(chatUnreadQuery(true)).data?.count ?? 0
  const items = (list.data?.pages.flatMap((p) => p.items) ??
    []) as ChatListItem[]

  useEffect(() => {
    document.title = unread > 0 ? `(${unread}) Live chat` : "Live chat"
  }, [unread])

  return (
    <div className="grid h-[calc(var(--content-h)-4rem)] min-h-96 overflow-hidden rounded-card border bg-card lg:grid-cols-[22rem_1fr]">
      <section
        aria-label="Chats"
        className={cn(
          "min-h-0 flex-col border-r",
          selected ? "hidden lg:flex" : "flex"
        )}
      >
        <div className="border-b p-3">
          <Tabs
            value={status}
            onValueChange={(next) =>
              void setState({ status: next as "open" | "closed", c: null })
            }
          >
            <TabsList>
              <TabsTrigger value="open">Open</TabsTrigger>
              <TabsTrigger value="closed">Closed</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {list.isPending ? (
            <CardSkeleton />
          ) : list.isError ? (
            <div role="alert" className="flex flex-col items-start gap-3 p-4">
              <p className="text-sm">{list.error.message}</p>
              <Button variant="outline" onClick={() => void list.refetch()}>
                Try again
              </Button>
            </div>
          ) : items.length === 0 ? (
            <div className="p-4">
              <EmptyState
                icon={MessagesSquareIcon}
                title={status === "open" ? "No open chats" : "No closed chats"}
                description="Conversations from the site's chat appear here."
              />
            </div>
          ) : (
            <ul>
              {items.map((chat) => (
                <Row
                  key={chat.id}
                  chat={chat}
                  selected={chat.id === selected}
                  mine={chat.assignedTo === user.id}
                  onSelect={() => void setState({ c: chat.id })}
                />
              ))}
            </ul>
          )}
          {list.hasNextPage ? (
            <div className="p-3">
              <Button
                variant="outline"
                size="sm"
                disabled={list.isFetchingNextPage}
                onClick={() => void list.fetchNextPage()}
              >
                Load more
              </Button>
            </div>
          ) : null}
        </div>
      </section>
      <section
        aria-label="Conversation"
        className={cn("min-h-0", selected ? "block" : "hidden lg:block")}
      >
        {selected ? (
          <ChatThread
            key={selected}
            id={selected}
            onBack={() => void setState({ c: null })}
            onGone={() => void setState({ c: null })}
          />
        ) : (
          <div className="grid h-full place-items-center p-6 text-sm text-muted-foreground">
            Pick a chat to read it.
          </div>
        )}
      </section>
    </div>
  )
}
