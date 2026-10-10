import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import { clearOutbox, readOutbox, sendEmail } from "./index"

afterEach(clearOutbox)

describe("sendEmail with the log driver", () => {
  it("delivers with the configured sender", async () => {
    await sendEmail({
      to: "ann@example.com",
      subject: "Hi",
      html: "<p>Hi</p>",
      text: "Hi",
    })
    expect(readOutbox()).toEqual([
      {
        to: "ann@example.com",
        from: "Magda Kennedy <hello@example.com>",
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
      },
    ])
  })
})

describe("log driver output", () => {
  it("never logs replyTo", async () => {
    vi.stubEnv("NODE_ENV", "development")
    resetEnvForTests()
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    await sendEmail({
      to: ["a@example.com", "b@example.com"],
      subject: "Hi",
      html: "<p>t</p>",
      text: "body",
      replyTo: "visitor@example.com",
      idempotencyKey: "k/1",
    })
    const out = spy.mock.calls.flat().join("\n")
    expect(out).not.toContain("visitor@example.com")
    expect(out).toContain("idempotencyKey=k/1")
    expect(out).toContain("a@example.com, b@example.com")
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetEnvForTests()
  })

  const message = {
    to: "ann@example.com\r\nBcc: x@y.z",
    subject: "Hi\nthere",
    html: "<p>t</p>",
    text: "https://example.com/reset?token=SECRET",
  }
  const logged = async (nodeEnv: string) => {
    vi.stubEnv("NODE_ENV", nodeEnv)
    resetEnvForTests()
    const spy = vi.spyOn(console, "info").mockImplementation(() => {})
    await sendEmail(message)
    return spy.mock.calls.flat().join("\n")
  }
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    resetEnvForTests()
  })

  it("omits the body outside development and strips CR/LF", async () => {
    const out = await logged("production")
    expect(out).not.toContain("SECRET")
    expect(out).toContain("to=ann@example.com Bcc: x@y.z")
    expect(out).not.toMatch(/[\r\n]/)
  })

  it("prints the body in development", async () => {
    expect(await logged("development")).toContain("SECRET")
  })
})
