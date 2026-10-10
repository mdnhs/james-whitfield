// @vitest-environment jsdom
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { NuqsTestingAdapter } from "nuqs/adapters/testing"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GLOBALS } from "@/lib/content/globals"

import { ContactForm } from "./contact-form"

const copy = GLOBALS.contactForm.parse({
  labels: {
    name: "Name",
    email: "Email",
    phone: "Phone",
    topic: "Topic",
    format: "Format",
    message: "Message",
  },
  errors: {
    name: "NAME-ERR",
    email: "EMAIL-ERR",
    topic: "TOPIC-ERR",
    consent: "CONSENT-ERR",
    phone: "PHONE-ERR",
    rateLimited: "SLOW-DOWN",
    generic: "OOPS",
  },
  success: { title: "SENT-TITLE", body: "b" },
  consent: "I agree",
  button: "Send",
})
const props = {
  copy,
  topics: [{ slug: "anxiety", label: "Anxiety" }],
  formats: [{ slug: "online", label: "Online" }],
  plans: [],
  turnstileSiteKey: null,
}
const calls: { url: string; body?: unknown }[] = []
const mockApi = (leadStatus: number, leadBody: unknown) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input)
    calls.push({
      url,
      body: init?.body ? JSON.parse(String(init.body)) : undefined,
    })
    if (url.endsWith("/stamp"))
      return new Response(JSON.stringify({ stamp: "1.a" }))
    return new Response(JSON.stringify(leadBody), { status: leadStatus })
  })
afterEach(() => {
  vi.restoreAllMocks()
  calls.length = 0
})

async function fillAndSend() {
  const user = userEvent.setup()
  render(
    <NuqsTestingAdapter>
      <ContactForm {...props} />
    </NuqsTestingAdapter>
  )
  await user.type(screen.getByLabelText(/Name/), "Ann")
  await user.type(screen.getByLabelText(/Email/), "ann@example.com")
  await user.selectOptions(screen.getByLabelText(/Topic/), "anxiety")
  await user.click(screen.getByRole("checkbox"))
  await user.click(screen.getByRole("button", { name: "Send" }))
}

describe("ContactForm", () => {
  it("posts slugs, the stamp, an event id and the honeypot, then shows success", async () => {
    mockApi(201, { ok: true })
    await fillAndSend()
    expect(await screen.findByText("SENT-TITLE")).toBeTruthy()
    const lead = calls.find((c) => c.url === "/api/v1/public/leads")!
      .body as Record<string, unknown>
    expect(lead).toMatchObject({
      topic: "anxiety",
      format: "online",
      stamp: "1.a",
      website: "",
      consent: true,
    })
    expect(lead.eventId).toMatch(/^[0-9a-f-]{36}$/)
  })
  it("shows the API's field errors with the form's own copy", async () => {
    mockApi(400, {
      error: { code: "VALIDATION_FAILED", fieldErrors: { phone: ["x"] } },
    })
    await fillAndSend()
    expect(await screen.findByText("PHONE-ERR")).toBeTruthy()
  })
  it("explains a rate limit", async () => {
    mockApi(429, { error: { code: "RATE_LIMITED" } })
    await fillAndSend()
    expect(await screen.findByText("SLOW-DOWN")).toBeTruthy()
  })
  it("keeps the honeypot out of the accessibility tree", () => {
    mockApi(201, { ok: true })
    render(
      <NuqsTestingAdapter>
        <ContactForm {...props} />
      </NuqsTestingAdapter>
    )
    const trap = document.querySelector<HTMLInputElement>(
      'input[name="website"]'
    )!
    expect(trap.tabIndex).toBe(-1)
    expect(trap.autocomplete).toBe("off")
    expect(trap.closest("[aria-hidden='true']")).not.toBeNull()
  })
})
