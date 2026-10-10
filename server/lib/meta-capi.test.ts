import { describe, expect, it, vi } from "vitest"

import { buildLeadEvent, capiAllowedPath, sendCapi, sha256 } from "./meta-capi"

const input = {
  leadId: "7d0c2f1a-0000-4000-8000-000000000001",
  eventId: "0b5f3c1e-1d2a-4c8b-9e7f-123456789abc",
  eventTime: new Date("2026-10-10T12:00:00Z"),
  sourcePath: "/contact?topic=anxiety-stress#form",
  siteUrl: "https://magdakennedy.ie",
  ip: "203.0.113.9",
  userAgent: "Mozilla/5.0",
  fbp: "fb.1.1700000000000.123456789",
  fbc: "fb.1.1700000000000.IwAR0abc",
  email: "Ann@Example.com ",
  phone: "+353871234567",
  enhancedMatching: false,
}

describe("buildLeadEvent (brief §12.5)", () => {
  it("the default payload has no email, phone or condition-revealing URL", () => {
    const event = buildLeadEvent(input)
    expect(event).toEqual({
      event_name: "Lead",
      event_time: 1791633600,
      event_id: input.eventId,
      action_source: "website",
      event_source_url: "https://magdakennedy.ie/contact",
      user_data: {
        client_ip_address: "203.0.113.9",
        client_user_agent: "Mozilla/5.0",
        fbp: input.fbp,
        fbc: input.fbc,
        external_id: [sha256(input.leadId)],
      },
    })
    const json = JSON.stringify(event)
    for (const leak of [
      "ann@example.com",
      "Ann@Example.com",
      "353871234567",
      sha256("ann@example.com"),
      sha256("353871234567"),
      "anxiety",
      "topic",
      "?",
      "#",
      "custom_data",
      '"em"',
      '"ph"',
    ])
      expect(json).not.toContain(leak)
  })

  it("collapses article paths", () => {
    expect(
      buildLeadEvent({ ...input, sourcePath: "/insights/hypnosis-for-panic" })
        .event_source_url
    ).toBe("https://magdakennedy.ie/insights")
  })

  it("sends an owner-created CMS slug as the site root, keeps allowed routes", () => {
    expect(
      buildLeadEvent({ ...input, sourcePath: "/hypnotherapy-for-anxiety" })
        .event_source_url
    ).toBe("https://magdakennedy.ie/")
    expect(
      buildLeadEvent({ ...input, sourcePath: "/about?utm_source=x" })
        .event_source_url
    ).toBe("https://magdakennedy.ie/about")
  })

  it("drops malformed fbp/fbc and a missing IP", () => {
    const event = buildLeadEvent({
      ...input,
      fbp: "<script>",
      fbc: undefined,
      ip: null,
    })
    expect(event.user_data).toEqual({
      client_user_agent: "Mozilla/5.0",
      external_id: [sha256(input.leadId)],
    })
  })

  it("adds normalised, hashed em and ph only with enhanced matching (Ruling R12)", () => {
    const event = buildLeadEvent({ ...input, enhancedMatching: true })
    expect(event.user_data.em).toEqual([sha256("ann@example.com")])
    expect(event.user_data.ph).toEqual([sha256("353871234567")])
  })
})

describe("sendCapi", () => {
  const ok = () =>
    new Response(JSON.stringify({ events_received: 1 }), { status: 200 })
  const err = (status: number, message = "Invalid parameter") =>
    new Response(JSON.stringify({ error: { message } }), { status })
  const event = buildLeadEvent(input)

  it("posts to v26.0 with the token in the body, not the URL", async () => {
    const fetchImpl = vi.fn(async () => ok())
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "EAAB-secret",
      events: [event],
      fetchImpl: fetchImpl as never,
    })
    expect(result).toEqual({ ok: true, status: 200 })
    const [url, init] = fetchImpl.mock.calls[0]! as unknown as [
      string,
      RequestInit,
    ]
    expect(url).toBe("https://graph.facebook.com/v26.0/1234567890/events")
    expect(url).not.toContain("EAAB")
    expect(JSON.parse(String(init.body))).toEqual({
      data: [event],
      access_token: "EAAB-secret",
    })
  })

  it("adds test_event_code when given", async () => {
    const fetchImpl = vi.fn(async () => ok())
    await sendCapi({
      pixelId: "1234567890",
      token: "t",
      events: [event],
      testEventCode: "TEST123",
      fetchImpl: fetchImpl as never,
    })
    const init = (
      fetchImpl.mock.calls[0] as unknown as [string, RequestInit]
    )[1]
    expect(JSON.parse(String(init.body)).test_event_code).toBe("TEST123")
  })

  it("retries 5xx, 429 and network errors with backoff, then succeeds", async () => {
    const sleep = vi.fn(async () => undefined)
    const fetchImpl = vi
      .fn()
      .mockResolvedValueOnce(err(503))
      .mockRejectedValueOnce(new TypeError("fetch failed"))
      .mockResolvedValueOnce(ok())
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "t",
      events: [event],
      fetchImpl,
      sleep,
    })
    expect(result.ok).toBe(true)
    expect(fetchImpl).toHaveBeenCalledTimes(3)
    expect(sleep.mock.calls).toEqual([[1000], [4000]])
  })

  it("stops at once on other 4xx and never echoes the token", async () => {
    const fetchImpl = vi.fn(async () =>
      err(400, "Invalid OAuth access token: EAAB-secret")
    )
    const result = await sendCapi({
      pixelId: "1234567890",
      token: "EAAB-secret",
      events: [event],
      fetchImpl: fetchImpl as never,
      sleep: async () => undefined,
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
    expect(result).toEqual({
      ok: false,
      status: 400,
      message: "Invalid OAuth access token: [token]",
    })
  })
})

describe("capiAllowedPath", () => {
  it("never allows newsletter pages, however the path is written", () => {
    for (const path of [
      "/newsletter",
      "/newsletter/confirm?token=x",
      "/Newsletter/unsubscribe",
      "/%6Eewsletter/confirm",
      "//newsletter",
    ])
      expect(capiAllowedPath(path), path).toBe(false)
    for (const path of ["/contact", "/services/anxiety?x=1", "/insights/a"])
      expect(capiAllowedPath(path), path).toBe(true)
  })
})
