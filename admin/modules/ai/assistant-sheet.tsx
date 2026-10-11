// admin/modules/ai/assistant-sheet.tsx
"use client"

import { useChat } from "@ai-sdk/react"
import { useQueryClient } from "@tanstack/react-query"
import { cn } from "cn"
import { useCallback, useState, type RefObject } from "react"
import { toast } from "sonner"

import { aiApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import type { AiUIMessage } from "@/lib/ai/messages"
import type { ChatContext } from "@/lib/ai/schema"
import type { AiStatus } from "@/server/modules/ai/service"

import { AssistantPanel } from "./assistant-panel"
import { useContextTitle, useRouteContext } from "./route-context"
import { assistantTransport } from "./transport"

const EXPANDED_KEY = "admin.ai-assistant.expanded"

// Browser storage can be missing or throw (private mode, blocked storage);
// the panel then simply opens at its default width.
function readExpanded() {
  try {
    return window.localStorage.getItem(EXPANDED_KEY) === "1"
  } catch {
    return false
  }
}
function saveExpanded(value: boolean) {
  try {
    window.localStorage.setItem(EXPANDED_KEY, value ? "1" : "0")
  } catch {
    // Not remembered; nothing else depends on it.
  }
}

// After a turn, the browser's id for the person's message becomes the saved
// one, so a later edit can name it (Ruling R8: no client ids are trusted).
export function adoptUserMessageId(
  messages: AiUIMessage[],
  replyId: string,
  savedId: string
): AiUIMessage[] {
  const reply = messages.findIndex((m) => m.id === replyId)
  for (let i = (reply === -1 ? messages.length : reply) - 1; i >= 0; i--) {
    if (messages[i]!.role !== "user") continue
    if (messages[i]!.id === savedId) return messages
    const next = messages.slice()
    next[i] = { ...messages[i]!, id: savedId }
    return next
  }
  return messages
}

// The chat itself: the AI SDK client, the transport, the panel and Markdown.
// assistant.tsx loads this on first use, so none of it is in the first JS of
// an admin route. Once loaded it stays mounted, so the conversation survives
// route changes and closing the sheet. useResetOnHide is deliberately not
// used (spec §2).
export default function AssistantSheet({
  status,
  open,
  onOpenChange,
  trigger,
  composer,
}: {
  status: AiStatus
  open: boolean
  onOpenChange: (open: boolean) => void
  trigger: RefObject<HTMLButtonElement | null>
  composer: RefObject<HTMLTextAreaElement | null>
}) {
  const queryClient = useQueryClient()
  // Which saved conversation the next message continues, and which screen
  // goes with it. Closures, not a ref, because the transport (built once)
  // reads them when sending, not when rendering. A turn that finishes after
  // "New chat" or after opening another conversation must not pull the id
  // back, hence the epoch.
  const [session] = useState(() => {
    let id: string | null = null
    let context: ChatContext | null = null
    let epoch = 0
    let sentIn = 0
    return {
      id: () => id,
      context: () => context,
      switchTo: (next: string | null) => {
        id = next
        epoch++
      },
      sent: (next: ChatContext | null) => {
        sentIn = epoch
        context = next
      },
      adopt: (next: string) => {
        if (sentIn !== epoch) return false
        id = next
        return true
      },
    }
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [transport] = useState(() =>
    assistantTransport(session.id, session.context)
  )
  const [expanded, setExpanded] = useState(readExpanded)
  const route = useRouteContext()
  const contextTitle = useContextTitle(route)
  // The chip's ✕ leaves the screen out of the next message only.
  const [dismissedPath, setDismissedPath] = useState<string | null>(null)
  const dismissed = route !== null && dismissedPath === route.context.path
  const nextContext = () => (route && !dismissed ? route.context : null)
  const chat = useChat<AiUIMessage>({
    transport,
    onFinish: ({ message }) => {
      const id = message.metadata?.conversationId
      if (id && session.adopt(id)) {
        setActiveId(id)
        const saved = message.metadata?.userMessageId
        if (saved)
          // useChat calls the latest onFinish, and setMessages is stable.
          chat.setMessages((all) => adoptUserMessageId(all, message.id, saved))
      }
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.conversations,
      })
    },
  })

  const beforeSend = () => {
    session.sent(nextContext())
    setDismissedPath(null)
  }

  const newChat = useCallback(() => {
    void chat.stop()
    chat.setMessages([])
    chat.clearError()
    session.switchTo(null)
    setActiveId(null)
  }, [chat, session])

  const openConversation = useCallback(
    async (id: string) => {
      try {
        const conv = await queryClient.fetchQuery({
          queryKey: queryKeys.ai.conversation(id),
          queryFn: () =>
            parseResponse(aiApi.conversations[":id"].$get({ param: { id } })),
          staleTime: 0,
        })
        await chat.stop()
        chat.setMessages(conv.messages as AiUIMessage[])
        chat.clearError()
        session.switchTo(id)
        setActiveId(id)
      } catch (e) {
        toast.error((e as Error).message)
      }
    },
    [chat, queryClient, session]
  )

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        initialFocus={composer}
        finalFocus={trigger}
        showCloseButton={false}
        // Full screen on phones; a reading-width panel on desktop that can
        // widen to half the window.
        className={cn(
          "w-full max-w-none gap-0 overflow-hidden p-0 transition-all data-[side=right]:w-full sm:data-[side=right]:max-w-none",
          expanded
            ? "sm:data-[side=right]:w-[max(33rem,50vw)]"
            : "sm:data-[side=right]:w-[33rem]"
        )}
      >
        <AssistantPanel
          status={status}
          composerRef={composer}
          messages={chat.messages}
          chatStatus={chat.status}
          error={chat.error}
          activeConversationId={activeId}
          onSend={(text) => {
            beforeSend()
            void chat.sendMessage({ text })
          }}
          onStop={() => void chat.stop()}
          onNewChat={newChat}
          onOpenConversation={(id) => void openConversation(id)}
          onRegenerate={() => {
            beforeSend()
            void chat.regenerate()
          }}
          onEdit={(messageId, text) => {
            beforeSend()
            void chat.sendMessage({ text, messageId })
          }}
          screen={route?.screen ?? "default"}
          contextLabel={dismissed ? null : contextTitle}
          onDismissContext={() => setDismissedPath(route?.context.path ?? null)}
          expanded={expanded}
          onToggleExpanded={() => {
            const next = !expanded
            setExpanded(next)
            saveExpanded(next)
          }}
        />
      </SheetContent>
    </Sheet>
  )
}
