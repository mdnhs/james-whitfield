// admin/modules/ai/transport.ts
import { DefaultChatTransport } from "ai"

import type { AiUIMessage } from "@/lib/ai/messages"
import type { ChatContext } from "@/lib/ai/schema"

type RequestShape = {
  trigger: "submit-message" | "regenerate-message"
  messageId: string | undefined
  messages: AiUIMessage[]
}

// Ruling R8: only the new text, the conversation id and the screen's ids
// leave the browser, never the history. Regenerate sends no text; an edit
// names the saved message it replaces (useChat passes its id as messageId).
export function chatRequestBody(
  { trigger, messageId, messages }: RequestShape,
  conversationId: string | null,
  context: ChatContext | null
) {
  const base = {
    conversationId,
    ...(context ? { context } : {}),
  }
  if (trigger === "regenerate-message") return { ...base, regenerate: true }
  const last = messages.at(-1)
  const text = last
    ? last.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("")
    : ""
  // Without a saved conversation there is nothing to edit: a new one starts.
  return conversationId && messageId
    ? { ...base, text, editMessageId: messageId }
    : { ...base, text }
}

export function assistantTransport(
  getConversationId: () => string | null,
  getContext: () => ChatContext | null = () => null
) {
  return new DefaultChatTransport<AiUIMessage>({
    api: "/api/v1/admin/ai/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: (request) => ({
      body: chatRequestBody(request, getConversationId(), getContext()),
    }),
  })
}

// Non-2xx answers arrive as an error whose message is our JSON envelope;
// mid-stream failures carry the server's friendly text as is.
export function chatErrorMessage(error: Error | undefined): string | null {
  if (!error) return null
  if (error instanceof TypeError)
    return "Couldn't reach the server. Check your connection and try again."
  try {
    const body = JSON.parse(error.message) as { error?: { message?: unknown } }
    if (typeof body.error?.message === "string") return body.error.message
  } catch {
    // Not our envelope.
  }
  return error.message || "Something went wrong. Try again."
}
