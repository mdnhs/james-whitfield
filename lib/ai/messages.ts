// lib/ai/messages.ts
import { getToolName, isToolUIPart, type UIMessage } from "ai"

import { TOOL_LABELS, type ToolName } from "./labels"

// Isomorphic: the server saves with it and the sheet renders with it.
// `userMessageId` is the saved id of the turn's user message, so the sheet
// can later ask to edit it (the browser's own ids never reach the server).
export type AiMetadata = { conversationId?: string; userMessageId?: string }
export type AiUIMessage = UIMessage<AiMetadata>
export type AiPart = AiUIMessage["parts"][number]

export const HISTORY_LIMIT = 20
export const HISTORY_CHAR_BUDGET = 32_000

export const textOf = (message: { parts: AiPart[] }) =>
  message.parts.flatMap((p) => (p.type === "text" ? [p.text] : [])).join("")

export function toolLabel(part: AiPart): string | null {
  if (!isToolUIPart(part)) return null
  const output =
    part.state === "output-available"
      ? (part.output as { label?: unknown } | undefined)
      : undefined
  if (typeof output?.label === "string" && output.label)
    return output.label.slice(0, 120)
  return TOOL_LABELS[getToolName(part) as ToolName] ?? "site data"
}

// Ruling R9: tool outputs can hold page text or (opted-in) enquiry details,
// so only the label survives; reasoning and step markers are never kept.
export function persistableParts(parts: AiPart[]): AiPart[] {
  return parts.flatMap((part): AiPart[] => {
    if (part.type === "text")
      return part.text.trim() ? [{ type: "text", text: part.text }] : []
    if (isToolUIPart(part) && part.state === "output-available") {
      return [
        {
          type: part.type,
          toolCallId: part.toolCallId,
          state: "output-available",
          input: {},
          output: { label: toolLabel(part) },
        } as AiPart,
      ]
    }
    return []
  })
}

// Ruling R9, wire side: what a finished lookup returned can hold page text or
// opted-in enquiry details, so the browser is only ever sent its label.
export function labelOnlyChunk<T extends { type: string }>(chunk: T): T {
  if (chunk.type !== "tool-output-available") return chunk
  const { output } = chunk as unknown as { output?: { label?: unknown } }
  const label =
    typeof output?.label === "string" && output.label
      ? output.label.slice(0, 120)
      : "site data"
  return { ...chunk, output: { label } }
}

export const textOnly = (message: AiUIMessage): AiUIMessage => ({
  ...message,
  parts: message.parts.filter((p) => p.type === "text"),
})

export function trimHistory(
  messages: AiUIMessage[],
  limit = HISTORY_LIMIT,
  budget = HISTORY_CHAR_BUDGET
) {
  const out = messages.slice(-limit)
  let total = out.reduce((n, m) => n + textOf(m).length, 0)
  while (out.length > 1 && total > budget) total -= textOf(out.shift()!).length
  // Some providers need a user turn first (Anthropic).
  while (out.length > 1 && out[0]!.role !== "user") out.shift()
  return out
}
