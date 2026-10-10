import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: vi.fn(),
}))
const deferred = vi.hoisted(() => ({ tasks: [] as Promise<unknown>[] }))
vi.mock("next/server", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/server")>()),
  after: (task: () => unknown) => {
    deferred.tasks.push(Promise.resolve().then(task))
  },
}))
const drain = async () => {
  await Promise.allSettled(deferred.tasks.splice(0))
}

import { app } from "@/server/api/app"
import { closeDb, getDb } from "@/server/db/client"
import { redirects } from "@/server/db/schema"

import { insertArticle, insertTaxonomy } from "../helpers/articles"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)
const resolve = async (path: string) => {
  const res = await app.request(
    `/api/v1/resolve?path=${encodeURIComponent(path)}`
  )
  return {
    status: res.status,
    body: res.status === 200 ? await res.json() : null,
    cache: res.headers.get("cache-control"),
  }
}

describe("route resolver", () => {
  it("knows live pages, live articles, redirects and missing paths", async () => {
    const asset = await insertMedia()
    await insertPage({
      path: "/about",
      systemKey: "about",
      document: heroDocument(asset.id),
      published: true,
    })
    await insertPage({
      path: "/privacy",
      systemKey: "privacy",
      document: heroDocument(asset.id),
    })
    const { category, author, media } = await insertTaxonomy()
    await insertArticle({
      slug: "calm",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
    })
    await insertArticle({
      slug: "draft",
      categoryId: category.id,
      authorId: author.id,
      coverId: media.id,
      status: "draft",
    })
    await getDb()
      .insert(redirects)
      .values([
        { sourcePath: "/old", destination: "/about", statusCode: 308 },
        { sourcePath: "/off", destination: "/about", isActive: false },
      ])
    expect((await resolve("/about")).body).toEqual({ kind: "live" })
    expect((await resolve("/insights/calm")).body).toEqual({ kind: "live" })
    expect((await resolve("/privacy")).body).toEqual({ kind: "missing" })
    expect((await resolve("/insights/draft")).body).toEqual({ kind: "missing" })
    expect((await resolve("/off")).body).toEqual({ kind: "missing" })
    expect((await resolve("/a/b")).body).toEqual({ kind: "pass" })
    const hit = await resolve("/old")
    expect(hit.body).toEqual({
      kind: "redirect",
      destination: "/about",
      statusCode: 308,
    })
    expect(hit.cache).toBe("no-store")
  })

  it("counts a redirect hit after the response", async () => {
    await getDb()
      .insert(redirects)
      .values({ sourcePath: "/old", destination: "/" })
    await resolve("/old")
    await resolve("/old")
    await drain()
    const [row] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.sourcePath, "/old"))
    expect(row!.hitCount).toBe(2)
    expect(row!.lastHitAt).toBeInstanceOf(Date)
  })

  it("rejects what is not a site path", async () => {
    expect((await resolve("https://evil.example")).status).toBe(400)
    expect((await resolve("/" + "a".repeat(600))).status).toBe(400)
  })
})
