// admin/modules/ai/transport.ts
import { DefaultChatTransport } from "ai"

import type { AiUIMessage } from "@/lib/ai/messages"

// Ruling R8: only the new text and the conversation id leave the browser.
export function assistantTransport(getConversationId: () => string | null) {
  return new DefaultChatTransport<AiUIMessage>({
    api: "/api/v1/admin/ai/chat",
    credentials: "same-origin",
    prepareSendMessagesRequest: ({ messages }) => {
      const last = messages.at(-1)
      const text = last
        ? last.parts
            .flatMap((p) => (p.type === "text" ? [p.text] : []))
            .join("")
        : ""
      return { body: { conversationId: getConversationId(), text } }
    },
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
