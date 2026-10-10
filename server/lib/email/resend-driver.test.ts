import { describe, expect, it, vi } from "vitest"

import { EmailError } from "./index"
import { createResendDriver } from "./resend-driver"

const envelope = {
  from: "Magda Kennedy <hello@example.com>",
  to: "ann@example.com",
  subject: "Hi",
  html: "<p>Hi</p>",
  text: "Hi",
  replyTo: "visitor@example.com",
  idempotencyKey: "enquiry/1/notify",
}

describe("resend driver", () => {
  it("passes the idempotency key and reply-to", async () => {
    const send = vi.fn().mockResolvedValue({ data: { id: "x" }, error: null })
    await createResendDriver("re_x", { emails: { send } }).send(envelope)
    expect(send).toHaveBeenCalledWith(
      {
        from: envelope.from,
        to: envelope.to,
        subject: "Hi",
        html: "<p>Hi</p>",
        text: "Hi",
        replyTo: "visitor@example.com",
      },
      { idempotencyKey: "enquiry/1/notify" }
    )
  })

  it("turns a { error } result into an EmailError", async () => {
    const send = vi.fn().mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Invalid from" },
    })
    await expect(
      createResendDriver("re_x", { emails: { send } }).send(envelope)
    ).rejects.toBeInstanceOf(EmailError)
  })
})
