// admin/modules/ai/transport.test.ts
import { describe, expect, it } from "vitest"

import type { AiUIMessage } from "@/lib/ai/messages"

import { chatErrorMessage, chatRequestBody } from "./transport"

describe("chatErrorMessage", () => {
  it("reads our error envelope, plain stream errors and network failures", () => {
    expect(
      chatErrorMessage(
        new Error(
          '{"error":{"code":"RATE_LIMITED","message":"Too many requests. Wait a moment and try again."}}'
        )
      )
    ).toBe("Too many requests. Wait a moment and try again.")
    expect(
      chatErrorMessage(
        new Error(
          "The free Gemini quota is used up for today — try later or switch model in settings"
        )
      )
    ).toMatch(/Gemini quota/)
    expect(chatErrorMessage(new TypeError("Failed to fetch"))).toMatch(
      /Couldn't reach the server/
    )
    expect(chatErrorMessage(undefined)).toBeNull()
  })
})

describe("chatRequestBody (Ruling R8)", () => {
  const user = (id: string, text: string): AiUIMessage => ({
    id,
    role: "user",
    parts: [{ type: "text", text }],
  })
  const conv = "6f1c1a0e-1b2c-4d3e-8f4a-5b6c7d8e9f00"
  const context = {
    path: `/admin/pages/${conv}`,
    entity: { type: "page" as const, id: conv },
  }

  it("sends the new text, the conversation id and the context, never the history", () => {
    const body = chatRequestBody(
      {
        trigger: "submit-message",
        messageId: undefined,
        messages: [user("a", "earlier"), user("b", "Hello")],
      },
      conv,
      context
    )
    expect(body).toEqual({ conversationId: conv, context, text: "Hello" })
  })

  it("leaves the context out when there is none", () => {
    expect(
      chatRequestBody(
        {
          trigger: "submit-message",
          messageId: undefined,
          messages: [user("b", "Hi")],
        },
        null,
        null
      )
    ).toEqual({ conversationId: null, text: "Hi" })
  })

  it("regenerates with a flag and no text", () => {
    expect(
      chatRequestBody(
        {
          trigger: "regenerate-message",
          messageId: undefined,
          messages: [user("b", "Hi")],
        },
        conv,
        null
      )
    ).toEqual({ conversationId: conv, regenerate: true })
  })

  it("edits by the saved message id, with the new text", () => {
    const saved = "7a2b3c4d-5e6f-4a1b-9c2d-3e4f5a6b7c8d"
    expect(
      chatRequestBody(
        {
          trigger: "submit-message",
          messageId: saved,
          messages: [user(saved, "Better")],
        },
        conv,
        null
      )
    ).toEqual({ conversationId: conv, text: "Better", editMessageId: saved })
    // No saved conversation yet: there is nothing to edit, so it starts one.
    expect(
      chatRequestBody(
        {
          trigger: "submit-message",
          messageId: saved,
          messages: [user(saved, "Better")],
        },
        null,
        null
      )
    ).toEqual({ conversationId: null, text: "Better" })
  })
})
