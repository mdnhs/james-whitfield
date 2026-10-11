// admin/modules/ai/assistant-sheet.test.ts
import { describe, expect, it } from "vitest"

import type { AiUIMessage } from "@/lib/ai/messages"

import { adoptUserMessageId } from "./assistant-sheet"

const msg = (id: string, role: "user" | "assistant"): AiUIMessage => ({
  id,
  role,
  parts: [{ type: "text", text: id }],
})

describe("adoptUserMessageId", () => {
  it("gives the person's message of this turn its saved id", () => {
    const before = [
      msg("u-old", "user"),
      msg("a-old", "assistant"),
      msg("tmp", "user"),
      msg("a-new", "assistant"),
    ]
    const after = adoptUserMessageId(before, "a-new", "saved")
    expect(after.map((m) => m.id)).toEqual(["u-old", "a-old", "saved", "a-new"])
    expect(before[2]!.id).toBe("tmp")
  })

  it("leaves the list alone when the id is already the saved one", () => {
    const list = [msg("saved", "user"), msg("a", "assistant")]
    expect(adoptUserMessageId(list, "a", "saved")).toBe(list)
  })

  it("uses the newest user message when the reply was dropped", () => {
    const list = [
      msg("u-old", "user"),
      msg("a-old", "assistant"),
      msg("tmp", "user"),
    ]
    expect(adoptUserMessageId(list, "missing", "saved").at(-1)!.id).toBe(
      "saved"
    )
  })
})
