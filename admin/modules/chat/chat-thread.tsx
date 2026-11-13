"use client"

import { useQuery } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react"
import { useEffect, useRef, useState } from "react"

import { useActor, usePermission } from "@/admin/lib/actor-context"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { ConfirmDialog } from "@/admin/modules/users/confirm-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"

import { type ChatMessage, chatDetailQuery, useChatActions } from "./queries"
import { formatMessageTime, useTabVisible } from "./present"

function Bubble({ message, visitor }: { message: ChatMessage; visitor: string }) {
  if (message.sender === "system") {
    return (
      <p className="py-1 text-center text-xs text-muted-foreground">
        {message.body}
      </p>
    )
  }
  const mine = message.sender !== "visitor"
  const who =
    message.sender === "visitor"
      ? visitor
      : message.sender === "ai"
        ? (message.senderName ?? "Assistant")
        : (message.senderName ?? "Team")
  return (
    <div className={mine ? "flex flex-col items-end" : "flex flex-col items-start"}>
      <div className="mb-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
        <span>{who}</span>
        {message.sender === "ai" ? (
          <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
            AI
          </Badge>
        ) : null}
        <time dateTime={message.createdAt}>
          {formatMessageTime(message.createdAt)}
        </time>
      </div>
      {/* Plain text only: no markdown, no links, whatever the author wrote. */}
      <p
        className={
          "max-w-[85%] rounded-2xl px-3 py-2 text-sm break-words whitespace-pre-wrap " +
          (mine ? "bg-primary text-primary-foreground" : "bg-muted")
        }
      >
        {message.body}
      </p>
    </div>
  )
}

export function ChatThread({
  id,
  onBack,
  onGone,
}: {
  id: string
  onBack(): void
  onGone(): void
}) {
  const visible = useTabVisible()
  const { user } = useActor()
  const canReply = usePermission({ chat: ["reply"] })
  const canManage = usePermission({ chat: ["manage"] })
  const detail = useQuery(chatDetailQuery(id, visible))
  const actions = useChatActions(id)
  const [draft, setDraft] = useState("")
  const [sendError, setSendError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const box = useRef<HTMLTextAreaElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const marked = useRef(0)

  const chat = detail.data?.chat
  const messages = detail.data?.messages
  const newest = messages?.at(-1)?.id ?? 0
  const closed = chat?.status === "closed"

  // The inbox keys this component by chat id, so each chat starts with an
  // empty composer and a fresh read marker; the composer takes focus.
  const ready = Boolean(chat) && !closed && canReply
  useEffect(() => {
    if (ready) box.current?.focus()
  }, [id, ready])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [newest])

  // Read receipts only count while the tab is in view.
  const { mutate: markRead } = actions.markRead
  useEffect(() => {
    if (!visible || document.hidden || newest <= marked.current) return
    marked.current = newest
    markRead(newest)
  }, [visible, newest, markRead])

  if (detail.isPending) return <CardSkeleton />
  if (detail.isError || !chat) {
    return (
      <div role="alert" className="flex flex-col items-start gap-3 p-6">
        <p className="text-sm">
          {detail.error?.message ?? "Couldn't load this chat."}
        </p>
        <Button variant="outline" onClick={() => void detail.refetch()}>
          Try again
        </Button>
      </div>
    )
  }

  const mineAssigned = chat.assignedTo === user.id
  const send = () => {
    const body = draft.trim()
    if (!body || actions.reply.isPending) return
    setSendError(null)
    actions.reply.mutate(body, {
      onSuccess: () => setDraft(""),
      onError: (error) => setSendError(error.message),
    })
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex flex-wrap items-center gap-2 border-b p-3">
        <Button
          variant="ghost"
          size="icon-sm"
          className="lg:hidden"
          aria-label="Back to chats"
          onClick={onBack}
        >
          <ArrowLeftIcon />
        </Button>
        <div className="mr-auto min-w-0">
          <h2 className="truncate text-sm font-semibold">{chat.visitorName}</h2>
          <p className="truncate text-xs text-muted-foreground">
            {[
              chat.visitorEmail,
              detail.data?.assigneeName
                ? `With ${detail.data.assigneeName}`
                : chat.aiEnabled
                  ? "AI is replying"
                  : null,
              closed ? "Ended" : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        {canReply && !closed ? (
          chat.aiEnabled ? (
            <Button
              size="sm"
              disabled={actions.takeover.isPending}
              onClick={() => actions.takeover.mutate()}
            >
              Take over
            </Button>
          ) : (
            <Button
              size="sm"
              variant="outline"
              disabled={actions.handback.isPending}
              onClick={() => actions.handback.mutate()}
            >
              Hand back to AI
            </Button>
          )
        ) : null}
        {canManage && !closed ? (
          <Button
            size="sm"
            variant="outline"
            disabled={actions.assign.isPending}
            onClick={() => actions.assign.mutate(mineAssigned ? null : user.id)}
          >
            {mineAssigned ? "Unassign" : "Assign to me"}
          </Button>
        ) : null}
        {canReply && !closed ? (
          <Button
            size="sm"
            variant="outline"
            disabled={actions.close.isPending}
            onClick={() => actions.close.mutate()}
          >
            Close
          </Button>
        ) : null}
        {canManage ? (
          <Button
            size="sm"
            variant="destructive"
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </Button>
        ) : null}
      </header>

      <div
        ref={scroller}
        className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-4"
      >
        {messages?.map((m) => (
          <Bubble key={m.id} message={m} visitor={chat.visitorName} />
        ))}
      </div>

      <footer className="border-t p-3">
        {sendError ? (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {sendError}
          </p>
        ) : null}
        {closed ? (
          <p className="text-sm text-muted-foreground">This chat has ended.</p>
        ) : canReply ? (
          <div className="flex items-end gap-2">
            <Textarea
              ref={box}
              aria-label="Reply"
              rows={2}
              maxLength={2000}
              placeholder="Write a reply. Sending also takes over from the AI."
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <Button
              disabled={!draft.trim() || actions.reply.isPending}
              onClick={send}
            >
              Send
            </Button>
          </div>
        ) : null}
      </footer>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete this chat?"
        description={`The whole conversation with ${chat.visitorName} is removed for good. This can't be undone.`}
        confirmLabel="Delete chat"
        pending={actions.remove.isPending}
        onClose={() => setConfirmDelete(false)}
        onConfirm={() =>
          actions.remove.mutate(undefined, {
            onSuccess: () => {
              setConfirmDelete(false)
              onGone()
            },
          })
        }
      />
    </div>
  )
}
