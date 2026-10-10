// @vitest-environment jsdom
import { render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { afterEach, describe, expect, it, vi } from "vitest"

import { GLOBALS } from "@/lib/content/globals"

import { toNewsletterView } from "../newsletter-view"
import { NewsletterBand } from "./newsletter-band"

vi.mock("@/components/media-image", () => ({ MediaImage: () => null }))
vi.mock("@/features/enterprise/components/enterprise-backdrop", () => ({
  EnterpriseBackdrop: ({ children }: { children: React.ReactNode }) => (
    <div>{children}</div>
  ),
}))

const content = toNewsletterView({
  ...GLOBALS.newsletter.parse({
    eyebrow: "Letter",
    title: "Title",
    subtitle: "Sub",
    emailLabel: "Email address",
    placeholder: "you@example.com",
    button: "Subscribe",
    success: "SUCCESS-COPY",
    errors: { email: "EMAIL-ERR", rateLimited: "SLOW-DOWN", generic: "OOPS" },
  }),
  image: null,
} as never)

const bodies: unknown[] = []
const mockFetch = (status: number) =>
  vi.spyOn(globalThis, "fetch").mockImplementation(async (_url, init) => {
    bodies.push(JSON.parse(String(init?.body)))
    return new Response("{}", { status })
  })

async function submit() {
  render(<NewsletterBand id="newsletter" content={content} />)
  await userEvent.type(screen.getByLabelText("Email address"), "a@b.co")
  await userEvent.click(screen.getByRole("button", { name: "Subscribe" }))
}

afterEach(() => {
  vi.restoreAllMocks()
  bodies.length = 0
})

describe("NewsletterBand", () => {
  it("shows the success copy on 201 and posts email, honeypot and path", async () => {
    mockFetch(201)
    await submit()
    expect(await screen.findByText("SUCCESS-COPY")).toBeTruthy()
    expect(bodies[0]).toEqual({ email: "a@b.co", website: "", sourcePath: "/" })
  })

  it("shows the rate-limited copy on 429", async () => {
    mockFetch(429)
    await submit()
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toBe("SLOW-DOWN")
    )
  })

  it("keeps the honeypot out of reach", () => {
    render(<NewsletterBand id="newsletter" content={content} />)
    const input = document.querySelector<HTMLInputElement>(
      'input[name="website"]'
    )!
    expect(input.tabIndex).toBe(-1)
    expect(input.closest('[aria-hidden="true"]')).not.toBeNull()
  })
})
