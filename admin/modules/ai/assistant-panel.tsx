// admin/modules/ai/assistant-panel.tsx
"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import {
  CopyIcon,
  HistoryIcon,
  PlusIcon,
  SettingsIcon,
  SquareIcon,
  Trash2Icon,
} from "lucide-react"
import Link from "next/link"
import { useRef, useState } from "react"
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
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Textarea } from "@/components/ui/textarea"
import { textOf, toolLabel, type AiUIMessage } from "@/lib/ai/messages"
import { GEMINI_FREE_TIER_WARNING, MAX_INPUT_CHARS } from "@/lib/ai/schema"
import type { AiStatus } from "@/server/modules/ai/service"

import { Markdown } from "./markdown"
import { aiConversationsQuery } from "./queries"
import { chatErrorMessage } from "./transport"

export const SETTINGS_PATH = "/admin/settings/ai-assistant"
const STARTERS = [
  "Write a meta description for…",
  "Rewrite this paragraph warmer: …",
  "Which pages need SEO work?",
  "Summarise this week's enquiries",
]

export type AssistantPanelProps = {
  status: AiStatus
  messages: AiUIMessage[]
  chatStatus: "submitted" | "streaming" | "ready" | "error"
  error: Error | undefined
  activeConversationId: string | null
  onSend: (text: string) => void
  onStop: () => void
  onNewChat: () => void
  onOpenConversation: (id: string) => void
}

export function AssistantPanel(props: AssistantPanelProps) {
  const { status, messages, chatStatus } = props
  const actor = useActor()
  const viewing = Boolean(actor.impersonatedBy)
  const [draft, setDraft] = useState("")
  const box = useRef<HTMLTextAreaElement>(null)
  const busy = chatStatus === "submitted" || chatStatus === "streaming"
  const send = () => {
    const text = draft.trim()
    if (!text || busy || viewing) return
    props.onSend(text)
    setDraft("")
  }
  const errorText = chatErrorMessage(props.error)

  return (
    <div className="flex h-full min-h-0 flex-col">
      <SheetHeader className="flex-row items-center gap-2 border-b pr-12">
        <div className="flex min-w-0 flex-1 flex-col">
          <SheetTitle>AI assistant</SheetTitle>
          <SheetDescription className="truncate">
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
              {status.model}
            </span>
          </SheetDescription>
        </div>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="New chat"
          onClick={props.onNewChat}
        >
          <PlusIcon />
        </Button>
        <HistoryMenu
          activeId={props.activeConversationId}
          onOpen={props.onOpenConversation}
          onDeletedActive={props.onNewChat}
          readOnly={viewing}
        />
        {status.canManage ? (
          <Link
            href={SETTINGS_PATH}
            aria-label="AI assistant settings"
            className={buttonVariants({ variant: "ghost", size: "icon-sm" })}
          >
            <SettingsIcon />
          </Link>
        ) : null}
      </SheetHeader>

      {!status.available ? (
        <div className="flex flex-1 flex-col items-start gap-3 p-4">
          <p>The AI assistant is turned off or not set up yet.</p>
          <Link href={SETTINGS_PATH} className={buttonVariants()}>
            Set up AI assistant
          </Link>
        </div>
      ) : (
        <>
          <div
            role="log"
            aria-live="polite"
            aria-label="Conversation"
            className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4"
          >
            {messages.length === 0 ? (
              <div className="flex flex-col gap-2">
                <p className="text-muted-foreground">
                  Ask for a draft, a rewrite or SEO help. I can read the site
                  but never change it.
                </p>
                {STARTERS.map((s) => (
                  <Button
                    key={s}
                    variant="outline"
                    className="justify-start text-left whitespace-normal"
                    onClick={() => {
                      setDraft(s)
                      box.current?.focus()
                    }}
                  >
                    {s}
                  </Button>
                ))}
              </div>
            ) : (
              messages.map((m) => <MessageView key={m.id} message={m} />)
            )}
            {errorText ? (
              <p role="alert" className="text-destructive">
                {errorText}
              </p>
            ) : null}
          </div>
          <form
            className="flex flex-col gap-2 border-t p-4"
            onSubmit={(e) => {
              e.preventDefault()
              send()
            }}
          >
            {status.freeTierWarning ? (
              <p role="note" className="text-xs text-muted-foreground">
                {GEMINI_FREE_TIER_WARNING}
              </p>
            ) : null}
            {viewing ? (
              <p className="text-xs text-muted-foreground">
                You can read conversations while viewing as someone, but not
                send messages.
              </p>
            ) : null}
            <Textarea
              ref={box}
              aria-label="Message the AI assistant"
              value={draft}
              maxLength={MAX_INPUT_CHARS}
              disabled={viewing}
              rows={3}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (
                  e.key === "Enter" &&
                  !e.shiftKey &&
                  !e.nativeEvent.isComposing
                ) {
                  e.preventDefault()
                  send()
                }
              }}
            />
            <div className="flex justify-end">
              {busy ? (
                <Button type="button" variant="outline" onClick={props.onStop}>
                  <SquareIcon data-icon="inline-start" />
                  Stop
                </Button>
              ) : (
                <Button type="submit" disabled={viewing || !draft.trim()}>
                  Send
                </Button>
              )}
            </div>
          </form>
        </>
      )}
    </div>
  )
}

function MessageView({ message }: { message: AiUIMessage }) {
  if (message.role === "user")
    return (
      <div className="self-end rounded-2xl bg-muted px-3 py-2 whitespace-pre-wrap">
        {textOf(message)}
      </div>
    )
  const text = textOf(message)
  return (
    <div className="flex flex-col gap-2">
      {message.parts.map((part, i) => {
        const label = toolLabel(part)
        if (label)
          return (
            <p key={i} className="text-xs text-muted-foreground">
              Looked at: {label}
            </p>
          )
        if (part.type === "text") return <Markdown key={i} text={part.text} />
        return null
      })}
      {text ? (
        <Button
          variant="ghost"
          size="sm"
          className="self-start"
          onClick={() =>
            void navigator.clipboard.writeText(text).then(
              () => toast.success("Copied"),
              () => toast.error("Couldn't copy")
            )
          }
        >
          <CopyIcon data-icon="inline-start" />
          Copy
        </Button>
      ) : null}
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
