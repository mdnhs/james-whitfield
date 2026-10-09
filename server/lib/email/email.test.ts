import { afterEach, describe, expect, it, vi } from "vitest"

import { resetEnvForTests } from "@/server/env"

import { clearOutbox, readOutbox, sendEmail } from "./index"
import { inviteEmail, passwordResetEmail } from "./templates"

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

describe("templates", () => {
  it("escapes user-supplied names and URLs in HTML", () => {
    const message = inviteEmail({
      name: "<script>x</script>",
      url: "https://example.com/r?token=1&x=2",
    })
    expect(message.html).not.toContain("<script>")
    expect(message.html).toContain("&lt;script&gt;")
    expect(message.html).toContain("https://example.com/r?token=1&amp;x=2")
    expect(message.text).toContain("https://example.com/r?token=1&x=2")
  })

  it("words the reset email for an existing account", () => {
    expect(
      passwordResetEmail({ name: "Ann", url: "https://example.com/r" }).subject
    ).toBe("Reset your admin password")
  })
})

describe("log driver output", () => {
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
