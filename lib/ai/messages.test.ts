// lib/ai/messages.test.ts
import { describe, expect, it } from "vitest"

import {
  persistableParts,
  textOf,
  trimHistory,
  type AiUIMessage,
} from "./messages"

const msg = (role: "user" | "assistant", text: string): AiUIMessage => ({
  id: text,
  role,
  parts: [{ type: "text", text }],
})

describe("persistableParts (Ruling R9)", () => {
  it("keeps text, reduces tool parts to their label and drops the rest", () => {
    const parts = [
      { type: "step-start" },
      { type: "reasoning", text: "thinking", state: "done" },
      {
        type: "tool-getPage",
        toolCallId: "c1",
        state: "output-available",
        input: { idOrPath: "/about" },
        output: { label: "About page", text: "SECRET PAGE TEXT" },
      },
      {
        type: "tool-getEnquiryStats",
        toolCallId: "c2",
        state: "output-error",
        input: {},
        errorText: "boom",
      },
      { type: "text", text: "Here you go." },
      { type: "text", text: "   " },
    ] as AiUIMessage["parts"]
    const kept = persistableParts(parts)
    expect(kept).toEqual([
      {
        type: "tool-getPage",
        toolCallId: "c1",
        state: "output-available",
        input: {},
        output: { label: "About page" },
      },
      { type: "text", text: "Here you go." },
    ])
    expect(JSON.stringify(kept)).not.toContain("SECRET")
  })
})

describe("trimHistory (Ruling R8)", () => {
  it("keeps the last 20 and drops oldest beyond the budget", () => {
    const many = Array.from({ length: 30 }, (_, i) =>
      msg(i % 2 ? "assistant" : "user", `m${i}`)
    )
    expect(trimHistory(many)).toHaveLength(20)
    const big = [
      msg("user", "a".repeat(20_000)),
      msg("assistant", "b".repeat(20_000)),
      msg("user", "c"),
    ]
    expect(trimHistory(big).map(textOf)).toEqual(["c"])
  })

  it("never starts with an assistant turn and always keeps the newest", () => {
    const out = trimHistory([
      msg("assistant", "x"),
      msg("user", "y".repeat(40_000)),
    ])
    expect(out.map((m) => m.role)).toEqual(["user"])
  })
})
