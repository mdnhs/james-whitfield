// tests/integration/api/ai-settings.test.ts
import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

const mocks = vi.hoisted(() => ({ getModel: vi.fn() }))
vi.mock("@/server/modules/ai/provider", async (importOriginal) => {
  const actual =
    await importOriginal<typeof import("@/server/modules/ai/provider")>()
  mocks.getModel.mockImplementation(actual.getModel)
  return { ...actual, getModel: mocks.getModel }
})

import { APICallError } from "ai"
import { MockLanguageModelV4 } from "ai/test"
import { eq } from "drizzle-orm"

import { ROLE_NAMES } from "@/lib/auth/permissions"
import { closeDb, getDb } from "@/server/db/client"
import { auditLogs, settings } from "@/server/db/schema"
import { resetEnvForTests } from "@/server/env"

import { adminRequest, cookieFor } from "../helpers/auth"
import { FAKE_KEY, seedAi } from "../helpers/ai"
import { resetDb } from "../helpers/db"

const KEY = "AIza-a-brand-new-key-ABCD"
const body = (over: Record<string, unknown> = {}) => ({
  version: 0,
  enabled: false,
  provider: "google",
  model: "gemini-flash-latest",
  baseUrl: "",
  allowedRoles: ["editor", "author", "marketer", "intake", "viewer"],
  systemPrompt: "",
  maxOutputTokens: 1024,
  ...over,
})
const put = (cookie: string, b: object) =>
  adminRequest("/ai/settings", cookie, { method: "PUT", body: b })
const ENC = process.env.APP_ENCRYPTION_KEY

beforeEach(resetDb)
afterEach(() => {
  process.env.APP_ENCRYPTION_KEY = ENC
  delete process.env.AI_PROVIDER_MOCK
  resetEnvForTests()
})
afterAll(closeDb)

describe("permissions (Ruling R1)", () => {
  it.each(ROLE_NAMES)("as %s", async (role) => {
    const cookie = await cookieFor(role)
    const manager = role === "owner" || role === "admin"
    expect((await adminRequest("/ai/settings", cookie)).status).toBe(
      manager ? 200 : 403
    )
    expect((await adminRequest("/ai/status", cookie)).status).toBe(200)
  })
})

describe("PUT /ai/settings", () => {
  it("encrypts the key and never returns or logs it", async () => {
    const cookie = await cookieFor("owner")
    const res = await put(cookie, body({ apiKey: KEY, enabled: true }))
    expect(res.status).toBe(200)
    const text = await res.text()
    expect(text).not.toContain(KEY)
    expect(JSON.parse(text).apiKey).toEqual({
      hasKey: true,
      last4: "ABCD",
      readable: true,
    })
    const [row] = await getDb()
      .select()
      .from(settings)
      .where(eq(settings.key, "ai"))
    expect(JSON.stringify(row!.value)).not.toContain(KEY)
    const logs = JSON.stringify(await getDb().select().from(auditLogs))
    expect(logs).not.toContain(KEY)
    expect(logs).toContain("ai.settings_update")
    expect(
      await (await adminRequest("/ai/settings", cookie)).text()
    ).not.toContain(KEY)
  })

  it("explains a missing APP_ENCRYPTION_KEY on the key field", async () => {
    delete process.env.APP_ENCRYPTION_KEY
    resetEnvForTests()
    const res = await put(await cookieFor("admin"), body({ apiKey: KEY }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.fieldErrors.apiKey[0]).toMatch(
      /APP_ENCRYPTION_KEY/
    )
  })

  it("refuses to turn on without a key (Ruling R5)", async () => {
    const res = await put(await cookieFor("owner"), body({ enabled: true }))
    expect(res.status).toBe(400)
    expect((await res.json()).error.fieldErrors.enabled).toBeDefined()
  })

  it("changing the provider or base URL drops the stored key (Review Focus 1)", async () => {
    const cookie = await cookieFor("owner")
    await put(cookie, body({ apiKey: KEY }))
    const switched = await put(
      cookie,
      body({
        version: 1,
        provider: "openai-compatible",
        model: "llama",
        baseUrl: "https://api.groq.com/openai/v1",
      })
    )
    expect((await switched.json()).apiKey.hasKey).toBe(false)
    await put(
      cookie,
      body({
        version: 2,
        provider: "openai-compatible",
        model: "llama",
        baseUrl: "https://api.groq.com/openai/v1",
        apiKey: KEY,
      })
    )
    const moved = await put(
      cookie,
      body({
        version: 3,
        provider: "openai-compatible",
        model: "llama",
        baseUrl: "https://openrouter.ai/api/v1",
      })
    )
    expect((await moved.json()).apiKey.hasKey).toBe(false)
    const enabledWithout = await put(
      cookie,
      body({
        version: 4,
        enabled: true,
        provider: "anthropic",
        model: "claude-haiku-4-5",
      })
    )
    expect((await enabledWithout.json()).error.fieldErrors.apiKey[0]).toMatch(
      /Anthropic/
    )
  })

  it("checks the OpenAI-compatible base URL", async () => {
    const res = await put(
      await cookieFor("owner"),
      body({
        provider: "openai-compatible",
        model: "m",
        baseUrl: "http://example.com/v1",
      })
    )
    expect(res.status).toBe(400)
    expect((await res.json()).error.fieldErrors.baseUrl[0]).toMatch(/https/)
  })

  it("keeps enquiry sharing owner-only with an acknowledgement (Ruling R15)", async () => {
    const admin = await put(
      await cookieFor("admin"),
      body({ shareEnquiryDetails: { enabled: true, acknowledge: true } })
    )
    expect(admin.status).toBe(403)
    const owner = await cookieFor("owner", "owner2@example.com")
    const noAck = await put(
      owner,
      body({ shareEnquiryDetails: { enabled: true } })
    )
    expect(
      (await noAck.json()).error.fieldErrors["shareEnquiryDetails.acknowledge"]
    ).toBeDefined()
    const ok = await put(
      owner,
      body({ shareEnquiryDetails: { enabled: true, acknowledge: true } })
    )
    expect((await ok.json()).value.shareEnquiryDetails.enabled).toBe(true)
    const actions = (await getDb().select().from(auditLogs)).map(
      (r) => r.action
    )
    expect(actions).toContain("ai.share_enquiry_details")
  })

  it("answers a stale version with 409", async () => {
    const cookie = await cookieFor("owner")
    await put(cookie, body())
    expect((await put(cookie, body({ version: 0 }))).status).toBe(409)
  })
})

describe("GET /ai/status", () => {
  it("is available to an allowed role and always to managers (Ruling R4)", async () => {
    await seedAi({ allowedRoles: ["editor"] })
    const viewer = await (
      await adminRequest("/ai/status", await cookieFor("viewer"))
    ).json()
    expect(viewer).toMatchObject({
      available: false,
      canManage: false,
      provider: null,
      model: null,
      freeTierWarning: false,
    })
    const editor = await (
      await adminRequest("/ai/status", await cookieFor("editor"))
    ).json()
    expect(editor).toMatchObject({
      available: true,
      model: "gemini-flash-latest",
      freeTierWarning: true,
    })
    const admin = await (
      await adminRequest("/ai/status", await cookieFor("admin"))
    ).json()
    expect(admin).toMatchObject({ available: true, canManage: true })
  })
})

describe("POST /ai/settings/models", () => {
  it("lists with the saved key and reports failures without the key", async () => {
    await seedAi()
    // Signed in first, so the spy only ever sees the provider call.
    const cookie = await cookieFor("owner")
    const spy = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          models: [
            {
              name: "models/gemini-flash-latest",
              supportedGenerationMethods: ["generateContent"],
            },
          ],
        })
      )
    )
    const ok = await adminRequest("/ai/settings/models", cookie, {
      method: "POST",
      body: { provider: "google" },
    })
    expect(await ok.json()).toEqual({
      ok: true,
      models: ["gemini-flash-latest"],
    })
    expect(
      new Headers(spy.mock.calls[0]![1]!.headers).get("x-goog-api-key")
    ).toBe(FAKE_KEY)
    spy.mockResolvedValueOnce(
      new Response(`{"error":{"message":"bad ${FAKE_KEY}"}}`, { status: 400 })
    )
    const failed = await (
      await adminRequest("/ai/settings/models", cookie, {
        method: "POST",
        body: { provider: "google" },
      })
    ).json()
    expect(failed.ok).toBe(false)
    expect(failed.message).not.toContain(FAKE_KEY)
    spy.mockRestore()
  })
})

describe("POST /ai/settings/test", () => {
  it("passes with the mock provider and is limited to 5 a minute", async () => {
    process.env.AI_PROVIDER_MOCK = "1"
    resetEnvForTests()
    await seedAi()
    const cookie = await cookieFor("owner")
    const first = await (
      await adminRequest("/ai/settings/test", cookie, { method: "POST" })
    ).json()
    expect(first.ok).toBe(true)
    for (let i = 0; i < 4; i++)
      await adminRequest("/ai/settings/test", cookie, { method: "POST" })
    const sixth = await adminRequest("/ai/settings/test", cookie, {
      method: "POST",
    })
    expect(sixth.status).toBe(429)
    expect(sixth.headers.get("retry-after")).toBeTruthy()
  })

  it("shows the provider's error without the key (Review Focus 2)", async () => {
    await seedAi()
    mocks.getModel.mockResolvedValueOnce(
      new MockLanguageModelV4({
        doGenerate: async () => {
          throw new APICallError({
            message: "x",
            url: "https://x",
            requestBodyValues: {},
            statusCode: 400,
            responseBody: `{"error":{"message":"API key not valid ${FAKE_KEY}"}}`,
          })
        },
      })
    )
    const res = await (
      await adminRequest("/ai/settings/test", await cookieFor("admin"), {
        method: "POST",
      })
    ).json()
    expect(res.ok).toBe(false)
    expect(res.message).toContain("API key not valid")
    expect(res.message).not.toContain(FAKE_KEY)
  })
})
