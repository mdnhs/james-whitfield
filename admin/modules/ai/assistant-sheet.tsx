// admin/modules/ai/assistant-sheet.tsx
"use client"

import { useChat } from "@ai-sdk/react"
import { useQueryClient } from "@tanstack/react-query"
import { useCallback, useState, type RefObject } from "react"
import { toast } from "sonner"

import { aiApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { Sheet, SheetContent } from "@/components/ui/sheet"
import type { AiUIMessage } from "@/lib/ai/messages"
import type { AiStatus } from "@/server/modules/ai/service"

import { AssistantPanel } from "./assistant-panel"
import { assistantTransport } from "./transport"

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
        className="w-full max-w-none gap-0 p-0 data-[side=right]:w-full sm:data-[side=right]:w-md sm:data-[side=right]:max-w-md"
      >
        <AssistantPanel
          status={status}
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
