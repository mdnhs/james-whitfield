// admin/modules/ai/assistant-panel.tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  HistoryIcon,
  Maximize2Icon,
  Minimize2Icon,
  SettingsIcon,
  SquarePenIcon,
  Trash2Icon,
  XIcon,
} from "lucide-react"
import Link from "next/link"
import { useLayoutEffect, useRef, useState, type RefObject } from "react"
import { toast } from "sonner"

import { useActor } from "@/admin/lib/actor-context"
import { aiApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button, buttonVariants } from "@/components/ui/button"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"
import {
  SheetClose,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import type { AiUIMessage } from "@/lib/ai/messages"
import type { AiStatus } from "@/server/modules/ai/service"

import { AI_LINE, AiAvatar } from "./ai-avatar"
import { Composer } from "./assistant-composer"
import {
  AssistantMessage,
  EmptyState,
  TypingIndicator,
  UserMessage,
} from "./assistant-messages"
import { aiConversationsQuery } from "./queries"
import type { AssistantScreen } from "./route-context"
import { STARTERS } from "./starters"
import { chatErrorMessage } from "./transport"

export const SETTINGS_PATH = "/admin/settings/ai-assistant"

export type AssistantPanelProps = {
  status: AiStatus
  // Lets the sheet focus the message box when it opens.
  composerRef?: RefObject<HTMLTextAreaElement | null>
  messages: AiUIMessage[]
  chatStatus: "submitted" | "streaming" | "ready" | "error"
  error: Error | undefined
  activeConversationId: string | null
  onSend: (text: string) => void
  onStop: () => void
  onNewChat: () => void
  onOpenConversation: (id: string) => void
  // Re-runs the last turn; the server drops the reply it replaces.
  onRegenerate?: () => void
  // Replaces one of the person's messages, and what followed, with new text.
  onEdit?: (messageId: string, text: string) => void
  screen?: AssistantScreen
  // "About page" when the open editor goes with the next message.
  contextLabel?: string | null
  onDismissContext?: () => void
  expanded?: boolean
  onToggleExpanded?: () => void
}

const firstName = (name: string) => name.trim().split(/\s+/)[0] ?? ""

// Whether the newest reply has shown anything yet (text or a lookup).
const hasVisibleParts = (m: AiUIMessage | undefined) =>
  Boolean(
    m &&
    m.parts.some(
      (p) => (p.type === "text" && p.text.trim()) || p.type.startsWith("tool-")
    )
  )

export function AssistantPanel(props: AssistantPanelProps) {
  const { status, messages, chatStatus, screen = "default" } = props
  const actor = useActor()
  const viewing = Boolean(actor.impersonatedBy)
  const [draft, setDraft] = useState("")
  const ownBox = useRef<HTMLTextAreaElement>(null)
  const box = props.composerRef ?? ownBox
  const scroller = useRef<HTMLDivElement>(null)
  const pinned = useRef(true)
  const busy = chatStatus === "submitted" || chatStatus === "streaming"
  const send = () => {
    const text = draft.trim()
    if (!text || busy || viewing) return
    pinned.current = true
    props.onSend(text)
    setDraft("")
  }
  const errorText = chatErrorMessage(props.error)
  const last = messages.at(-1)
  const thinking =
    chatStatus === "submitted" ||
    (chatStatus === "streaming" &&
      (last?.role !== "assistant" || !hasVisibleParts(last)))
  const lastUserIndex = messages.findLastIndex((m) => m.role === "user")
  const canChange = !busy && !viewing && Boolean(props.activeConversationId)

  // Follow the reply as it streams, unless the person scrolled up to read.
  useLayoutEffect(() => {
    const el = scroller.current
    if (el && pinned.current) el.scrollTop = el.scrollHeight
  }, [messages, thinking, errorText])

  return (
    <div className="flex h-full min-h-0 flex-col bg-sidebar">
      <SheetHeader className="relative flex-row items-center gap-3 px-4 py-3 sm:px-5">
        <AiAvatar />
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <SheetTitle className="text-[0.9375rem] leading-tight font-semibold">
            AI assistant
          </SheetTitle>
          <SheetDescription className="flex min-w-0">
            <span className="truncate rounded-full border bg-card px-2 py-px text-xs">
              <span className="sr-only">Model: </span>
              {status.model}
            </span>
          </SheetDescription>
        </div>
        <div className="flex items-center gap-0.5">
          <Button
            variant="ghost"
            size="icon-sm"
            className="rounded-full"
            aria-label="New chat"
            onClick={() => {
              props.onNewChat()
              box.current?.focus()
            }}
          >
            <SquarePenIcon />
          </Button>
          <HistoryMenu
            activeId={props.activeConversationId}
            onOpen={props.onOpenConversation}
            onDeletedActive={props.onNewChat}
            readOnly={viewing}
          />
          {props.onToggleExpanded ? (
            <Button
              variant="ghost"
              size="icon-sm"
              className="hidden rounded-full sm:inline-flex"
              aria-label="Expand"
              aria-pressed={Boolean(props.expanded)}
              onClick={props.onToggleExpanded}
            >
              {props.expanded ? <Minimize2Icon /> : <Maximize2Icon />}
            </Button>
          ) : null}
          {status.canManage ? (
            <Link
              href={SETTINGS_PATH}
              aria-label="AI assistant settings"
              className={buttonVariants({
                variant: "ghost",
                size: "icon-sm",
                className: "rounded-full",
              })}
            >
              <SettingsIcon />
            </Link>
          ) : null}
          <SheetClose
            render={
              <Button
                variant="ghost"
                size="icon-sm"
                className="rounded-full"
                aria-label="Close"
              />
            }
          >
            <XIcon />
          </SheetClose>
        </div>
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 bottom-0 h-px"
          style={{ backgroundImage: AI_LINE }}
        />
      </SheetHeader>

      {!status.available ? (
        <div className="flex flex-1 flex-col items-start gap-3 p-5">
          <p>The AI assistant is turned off or not set up yet.</p>
          <Link href={SETTINGS_PATH} className={buttonVariants()}>
            Set up AI assistant
          </Link>
        </div>
      ) : (
        <>
          <div
            ref={scroller}
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="min-h-0 flex-1 overflow-y-auto"
            onScroll={(e) => {
              const el = e.currentTarget
              pinned.current =
                el.scrollHeight - el.scrollTop - el.clientHeight < 80
            }}
          >
            <div className="mx-auto flex w-full max-w-176 flex-col gap-6 px-4 py-5 sm:px-6">
              {messages.length === 0 ? (
                <EmptyState
                  firstName={firstName(actor.user.name)}
                  screen={screen}
                  starters={STARTERS[screen]}
                  onPick={(prompt) => {
                    setDraft(prompt)
                    box.current?.focus()
                  }}
                />
              ) : (
                messages.map((m, i) =>
                  m.role === "user" ? (
                    <UserMessage
                      key={m.id}
                      message={m}
                      canEdit={
                        canChange &&
                        i === lastUserIndex &&
                        Boolean(props.onEdit)
                      }
                      onEdit={(text) => {
                        pinned.current = true
                        props.onEdit?.(m.id, text)
                      }}
                    />
                  ) : (
                    <AssistantMessage
                      key={m.id}
                      message={m}
                      canRegenerate={
                        canChange &&
                        i === messages.length - 1 &&
                        i > lastUserIndex &&
                        Boolean(props.onRegenerate)
                      }
                      onRegenerate={() => {
                        pinned.current = true
                        props.onRegenerate?.()
                      }}
                    />
                  )
                )
              )}
              {thinking ? <TypingIndicator /> : null}
              {errorText ? (
                <p
                  role="alert"
                  className="bg-danger-soft text-danger rounded-xl border border-destructive/30 px-3 py-2 text-sm"
                >
                  {errorText}
                </p>
              ) : null}
            </div>
          </div>
          <Composer
            boxRef={box}
            draft={draft}
            onDraft={setDraft}
            onSend={send}
            onStop={props.onStop}
            busy={busy}
            readOnly={viewing}
            freeTierWarning={status.freeTierWarning}
            contextLabel={props.contextLabel ?? null}
            onDismissContext={() => {
              props.onDismissContext?.()
              box.current?.focus()
            }}
          />
        </>
      )}
    </div>
  )
}

function HistoryMenu({
  activeId,
  onOpen,
  onDeletedActive,
  readOnly,
}: {
  activeId: string | null
  onOpen: (id: string) => void
  onDeletedActive: () => void
  readOnly: boolean
}) {
  const [open, setOpen] = useState(false)
  const queryClient = useQueryClient()
  const list = useQuery({ ...aiConversationsQuery(), enabled: open })
  const remove = useMutation({
    mutationFn: (id: string) =>
      parseResponse(aiApi.conversations[":id"].$delete({ param: { id } })),
    onSuccess: (_, id) => {
      if (id === activeId) onDeletedActive()
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.conversations,
      })
    },
    onError: (e) => toast.error(e.message),
  })
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon-sm" aria-label="History" />}
      >
        <HistoryIcon />
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-2">
        {list.data?.items.length ? (
          <ul
            className="flex max-h-80 flex-col overflow-y-auto"
            aria-label="Past conversations"
          >
            {list.data.items.map((c) => (
              <li key={c.id} className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  className="min-w-0 flex-1 justify-start truncate"
                  onClick={() => {
                    onOpen(c.id)
                    setOpen(false)
                  }}
                >
                  {c.title}
                </Button>
                {readOnly ? null : (
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Delete “${c.title}”`}
                    onClick={() => remove.mutate(c.id)}
                  >
                    <Trash2Icon />
                  </Button>
                )}
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-2 text-sm text-muted-foreground">
            {list.isLoading ? "Loading…" : "No saved conversations yet."}
          </p>
        )}
      </PopoverContent>
    </Popover>
  )
}
