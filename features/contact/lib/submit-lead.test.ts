import { afterEach, describe, expect, it, vi } from "vitest"

import { submitLead } from "./submit-lead"

const respond = (status: number, body: unknown) =>
  vi
    .spyOn(globalThis, "fetch")
    .mockResolvedValue(new Response(JSON.stringify(body), { status }))
afterEach(() => vi.restoreAllMocks())
const payload = { name: "Ann" } as never

describe("submitLead", () => {
  it("maps the API's answers", async () => {
    respond(201, { ok: true })
    expect(await submitLead(payload)).toEqual({ ok: true })
    respond(400, {
      error: { code: "VALIDATION_FAILED", fieldErrors: { email: ["bad"] } },
    })
    expect(await submitLead(payload)).toEqual({
      ok: false,
      kind: "fields",
      fieldErrors: { email: ["bad"] },
    })
    respond(429, { error: { code: "RATE_LIMITED" } })
    expect(await submitLead(payload)).toEqual({
      ok: false,
      kind: "rate-limited",
    })
    respond(500, {})
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "error" })
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new TypeError("offline"))
    expect(await submitLead(payload)).toEqual({ ok: false, kind: "error" })
  })
})
