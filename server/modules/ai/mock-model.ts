// server/modules/ai/mock-model.ts
import "server-only"

import { simulateReadableStream } from "ai"
import { MockLanguageModelV4 } from "ai/test"

// Ruling R7: a scripted model for development, E2E and integration tests.
// provider.ts loads this file only when AI_PROVIDER_MOCK is on.
type StreamResult = Awaited<ReturnType<MockLanguageModelV4["doStream"]>>
export type StreamPart =
  StreamResult["stream"] extends ReadableStream<infer P> ? P : never
type Usage = Extract<StreamPart, { type: "finish" }>["usage"]
type Prompt = Parameters<MockLanguageModelV4["doStream"]>[0]["prompt"]

export const mockUsage = (input: number, output: number): Usage => ({
  inputTokens: {
    total: input,
    noCache: input,
    cacheRead: undefined,
    cacheWrite: undefined,
  },
  outputTokens: { total: output, text: output, reasoning: undefined },
})

export function textParts(text: string): StreamPart[] {
  const words = text.split(/(?<= )/)
  return [
    { type: "text-start", id: "t1" },
    ...words.map((delta): StreamPart => ({
      type: "text-delta",
      id: "t1",
      delta,
    })),
    { type: "text-end", id: "t1" },
    {
      type: "finish",
      finishReason: { unified: "stop", raw: undefined },
      usage: mockUsage(20, words.length),
    },
  ]
}

export function toolCallParts(
  toolName: string,
  input: object = {}
): StreamPart[] {
  return [
    {
      type: "tool-call",
      toolCallId: `call-${toolName}`,
      toolName,
      input: JSON.stringify(input),
    },
    {
      type: "finish",
      finishReason: { unified: "tool-calls", raw: undefined },
      usage: mockUsage(20, 5),
    },
  ]
}

export const streamOf = (
  parts: StreamPart[],
  chunkDelayInMs: number | null = null
) => ({
  stream: simulateReadableStream({ chunks: parts, chunkDelayInMs }),
})

function lastUserText(prompt: Prompt) {
  for (let i = prompt.length - 1; i >= 0; i--) {
    const message = prompt[i]!
    if (message.role === "user")
      return message.content
        .map((p) => (p.type === "text" ? p.text : ""))
        .join("")
  }
  return ""
}

// "…SEO…" makes it look at SEO health first, so E2E sees a "Looked at" line.
export function mockModel(modelId = "mock-model") {
  return new MockLanguageModelV4({
    provider: "mock",
    modelId,
    doGenerate: async () => ({
      content: [{ type: "text", text: "OK" }],
      finishReason: { unified: "stop", raw: undefined },
      usage: mockUsage(5, 1),
      warnings: [],
    }),
    doStream: async ({ prompt }) => {
      const afterTool = prompt.at(-1)?.role === "tool"
      const text = lastUserText(prompt)
      if (!afterTool && /\bseo\b/i.test(text))
        return streamOf(toolCallParts("getSeoHealth"))
      return streamOf(
        textParts(
          afterTool
            ? "Mock reply: I looked at the SEO health report."
            : `Mock reply: ${text}`
        ),
        30
      )
    },
  })
}
