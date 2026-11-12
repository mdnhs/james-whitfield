import { describe, expect, it } from "vitest"

import { isCrisis } from "./crisis"

describe("isCrisis", () => {
  it.each([
    "I'm thinking about suicide",
    "feeling suicidal",
    "I want to kill myself",
    "I'd rather end my life",
    "I do self harm",
    "history of self-harm",
    "I might hurt myself",
    "I just want to die",
    "took an overdose",
  ])("matches %s", (t) => expect(isCrisis(t)).toBe(true))

  it.each([
    "a die-cast model",
    "I need to skill myself up",
    "a diet and a die",
    "I will not overdosed on tea",
    "hello there",
  ])("does not match %s", (t) => expect(isCrisis(t)).toBe(false))

  it("is case-insensitive", () => {
    expect(isCrisis("WANT TO DIE")).toBe(true)
    expect(isCrisis("Kill Myself")).toBe(true)
  })
})
