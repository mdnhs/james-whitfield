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
    "I want to end it all",
    "I want to end my life.",
    "thinking of self harm",
    "I took an overdose",
    // Accepted false positives: safety bias, a spare notice beats a missed one.
    "I'm killing myself at the gym",
    "I want to be dead honest",
  ])("matches %s", (t) => expect(isCrisis(t)).toBe(true))

  it.each([
    "a die-cast model",
    "I need to skill myself up",
    "a diet and a die",
    "I want to be a doctor",
    "the sunset ends it for today",
    "hello there",
    "it's killing my self-confidence",
    "my anxiety is hurting my self-esteem",
    "I want to end my life-long habit",
    "In the end it all worked out",
    "I want to take my own life back",
    "I want to end my smoking habit",
    "it's killing my sleep",
    "I'm dying to try it",
  ])("does not match %s", (t) => expect(isCrisis(t)).toBe(false))

  it("is case-insensitive", () => {
    expect(isCrisis("WANT TO DIE")).toBe(true)
    expect(isCrisis("Kill Myself")).toBe(true)
  })
})
