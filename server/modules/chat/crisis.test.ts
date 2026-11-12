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
    "I keep killing myself over this",
    "thinking of kill my self",
    "I am hurting myself",
    "I am ending my life",
    "she is self-harming",
    "I am self harming",
    "he overdosed",
    "she is overdosing",
    "I am wanting to die",
    "I want to be dead",
    "I want to take my own life",
    "I just want to end it all",
  ])("matches %s", (t) => expect(isCrisis(t)).toBe(true))

  it.each([
    "a die-cast model",
    "I need to skill myself up",
    "a diet and a die",
    "I want to be a doctor",
    "the sunset ends it for today",
    "hello there",
  ])("does not match %s", (t) => expect(isCrisis(t)).toBe(false))

  it("is case-insensitive", () => {
    expect(isCrisis("WANT TO DIE")).toBe(true)
    expect(isCrisis("Kill Myself")).toBe(true)
  })
})
