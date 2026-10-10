import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

// 'use cache' is inert outside Next; its helpers must be too.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const resolve = (path: string) =>
  app.request(`/api/v1/redirects?path=${encodeURIComponent(path)}`)

describe("redirect resolver", () => {
  it("answers active rows and nothing else", async () => {
    await getDb()
      .insert(redirects)
      .values([
        { sourcePath: "/insights/old", destination: "/insights/new" },
        {
          sourcePath: "/insights/off",
          destination: "/insights",
          isActive: false,
        },
      ])
    const hit = await resolve("/insights/old")
    expect(hit.status).toBe(200)
    expect(await hit.json()).toEqual({
      destination: "/insights/new",
      statusCode: 301,
    })
    expect((await resolve("/insights/off")).status).toBe(204)
    expect((await resolve("/insights/none")).status).toBe(204)
  })

  it("rejects paths it does not serve", async () => {
    expect((await resolve("https://evil.example")).status).toBe(400)
    expect((await resolve("/about/../x")).status).toBe(400)
  })
})
