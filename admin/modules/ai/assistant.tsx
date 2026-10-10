// admin/modules/ai/assistant.tsx
"use client"

import { useChat } from "@ai-sdk/react"
import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useRef, useState } from "react"
import { toast } from "sonner"

import { AiSparkleIcon } from "@/admin/components/icons/ai-sparkle-icon"
import { ICON_BUTTON } from "@/admin/components/shell/constants"
import { aiApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import type { AiUIMessage } from "@/lib/ai/messages"

import { AssistantPanel } from "./assistant-panel"
import { aiStatusQuery } from "./queries"
import { assistantTransport } from "./transport"
import { useAssistantHotkey } from "./use-assistant-hotkey"

// Lives in the topbar, which the panel layout keeps mounted across
// navigation, so the conversation survives route changes. useResetOnHide is
// deliberately not used (spec §2).
export function AiAssistant() {
  const status = useQuery(aiStatusQuery())
  const queryClient = useQueryClient()
  const [open, setOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  // Which saved conversation the next message continues. Closures, not a
  // ref, because the transport (built once) reads it when sending, not when
  // rendering. A turn that finishes after "New chat" or after opening another
  // conversation must not pull the id back, hence the epoch.
  const [session] = useState(() => {
    let id: string | null = null
    let epoch = 0
    let sentIn = 0
    return {
      id: () => id,
      switchTo: (next: string | null) => {
        id = next
        epoch++
      },
      sent: () => void (sentIn = epoch),
      adopt: (next: string) => {
        if (sentIn !== epoch) return false
        id = next
        return true
      },
    }
  })
  const [activeId, setActiveId] = useState<string | null>(null)
  const [transport] = useState(() => assistantTransport(session.id))
  const chat = useChat<AiUIMessage>({
    transport,
    onFinish: ({ message }) => {
      const id = message.metadata?.conversationId
      if (id && session.adopt(id)) setActiveId(id)
      void queryClient.invalidateQueries({
        queryKey: queryKeys.ai.conversations,
      })
    },
  })
  const s = status.data
  const visible = Boolean(s && (s.available || s.canManage))
  const toggle = useCallback(() => setOpen((v) => !v), [])
  useAssistantHotkey(visible, toggle)

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

  if (!visible || !s) return null
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button
        ref={trigger}
        variant="outline"
        size="icon-lg"
        className={ICON_BUTTON}
        aria-label="AI assistant"
        aria-keyshortcuts="Meta+J Control+J"
        onClick={() => setOpen(true)}
      >
        <AiSparkleIcon />
      </Button>
      <SheetContent
        side="right"
        initialFocus={composer}
        finalFocus={trigger}
        className="w-full max-w-none gap-0 p-0 data-[side=right]:w-full sm:data-[side=right]:w-md sm:data-[side=right]:max-w-md"
      >
        <AssistantPanel
          status={s}
          composerRef={composer}
          messages={chat.messages}
          chatStatus={chat.status}
          error={chat.error}
          activeConversationId={activeId}
          onSend={(text) => {
            session.sent()
            void chat.sendMessage({ text })
          }}
          onStop={() => void chat.stop()}
          onNewChat={newChat}
          onOpenConversation={(id) => void openConversation(id)}
        />
      </SheetContent>
    </Sheet>
  )
}
