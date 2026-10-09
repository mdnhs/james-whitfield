import { afterEach, describe, expect, it } from "vitest"

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
