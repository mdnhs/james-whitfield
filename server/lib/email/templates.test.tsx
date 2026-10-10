import { describe, expect, it } from "vitest"

import {
  deliveryFailureEmail,
  enquiryAutoReplyEmail,
  inviteEmail,
  newEnquiryEmail,
  newsletterConfirmationEmail,
  passwordResetEmail,
} from "./templates"

const enquiry = {
  name: "<b>Ann</b>",
  email: "ann@example.com",
  phone: "+353871234567",
  topic: "Anxiety",
  format: "Online",
  plan: null,
  adminUrl: "https://site.example/admin/leads?lead=1",
}

describe("templates", () => {
  it("escapes names and keeps links usable", async () => {
    const m = await inviteEmail({
      name: "<script>x</script>",
      url: "https://e.x/r?token=1&x=2",
    })
    expect(m.html).not.toContain("<script>")
    expect(m.html).toContain("https://e.x/r?token=1&amp;x=2")
    expect(m.text).toContain("https://e.x/r?token=1&x=2")
    expect(
      (await passwordResetEmail({ name: "Ann", url: "https://e.x" })).subject
    ).toBe("Reset your admin password")
  })

  it("leaves the message out of the notification by default", async () => {
    const m = await newEnquiryEmail({
      ...enquiry,
      message: undefined,
      includeMessage: false,
    })
    expect(m.subject).toBe("New enquiry from <b>Ann</b>")
    expect(m.html).not.toContain("<b>Ann</b>")
    expect(m.html).toContain(enquiry.adminUrl)
    expect(`${m.html}${m.text}`).not.toContain("SECRET-MESSAGE")
  })

  it("adds the message only when switched on", async () => {
    const m = await newEnquiryEmail({
      ...enquiry,
      message: "SECRET-MESSAGE",
      includeMessage: true,
    })
    expect(m.text).toContain("SECRET-MESSAGE")
  })

  it("renders the other templates with plain-text versions", async () => {
    for (const m of [
      await enquiryAutoReplyEmail({
        name: "Ann",
        subject: "Thanks",
        body: "Hi {name}, we got it.",
      }),
      await newsletterConfirmationEmail({
        subject: "Confirm",
        body: "Please confirm.",
        confirmUrl: "https://e.x/c?token=t",
        unsubscribeUrl: "https://e.x/u?token=u",
      }),
      await deliveryFailureEmail({
        kind: "notification",
        leadUrl: "https://e.x/l",
        occurredAt: new Date(0),
      }),
    ]) {
      expect(m.html).toMatch(/^<!DOCTYPE html/i)
      expect(m.text.length).toBeGreaterThan(10)
    }
    const reply = await enquiryAutoReplyEmail({
      name: "Ann",
      subject: "Thanks",
      body: "Hi {name}.",
    })
    expect(reply.text).toContain("Hi Ann.")
  })
})
