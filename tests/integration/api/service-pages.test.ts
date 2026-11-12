import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
// 'use cache' is inert outside Next; its helpers must be too.
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  cacheTag: vi.fn(),
  cacheLife: vi.fn(),
  revalidateTag: next.revalidateTag,
}))

import { closeDb, getDb } from "@/server/db/client"
import {
  ctaBands,
  pages,
  redirects,
  revisions,
  services,
} from "@/server/db/schema"
import { getPublishedPage } from "@/server/modules/content/queries"
import { getRouteTable } from "@/server/modules/redirects/queries"
import { getLlmsEntries, getSitemapEntries } from "@/server/modules/seo/queries"

import { adminRequest, cookieFor } from "../helpers/auth"
import { heroDocument, insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)

// A service, the /services system page (its hero image is the template's)
// and, unless told otherwise, one visible CTA band.
async function setup({ band = true } = {}) {
  const asset = await insertMedia()
  await insertPage({
    path: "/services",
    systemKey: "services",
    document: heroDocument(asset.id, "Services"),
    published: true,
  })
  const [service] = await getDb()
    .insert(services)
    .values({ slug: "a", title: "Anxiety", body: "Calmer days.", icon: "mind" })
    .returning()
  if (band) {
    await getDb()
      .insert(ctaBands)
      .values({
        name: "Main",
        eyebrow: "Next step",
        title: "Book a call",
        bullets: ["Free"],
        cta: { label: "Book", href: "/contact" },
        imageId: asset.id,
      })
  }
  return { asset, service: service! }
}

const enable = (cookie: string, id: string) =>
  adminRequest(`/service-pages/${id}`, cookie, { method: "POST" })
const disable = (cookie: string, id: string) =>
  adminRequest(`/service-pages/${id}`, cookie, { method: "DELETE" })

const findService = async (id: string) =>
  (await getDb().select().from(services).where(eq(services.id, id)))[0]!
const findPage = async (id: string) =>
  (await getDb().select().from(pages).where(eq(pages.id, id)))[0]

async function publish(cookie: string, pageId: string) {
  const page = (await findPage(pageId))!
  const res = await adminRequest(`/pages/${pageId}/publish`, cookie, {
    method: "POST",
    body: { version: page.version },
  })
  expect(res.status).toBe(200)
}

async function patchService(
  cookie: string,
  id: string,
  values: Record<string, unknown>
) {
  const { version } = await findService(id)
  return adminRequest(`/collections/services/${id}`, cookie, {
    method: "PATCH",
    body: { version, values },
  })
}

describe("service detail pages", () => {
  it("enables a draft page from the template at /services/<slug>", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    const res = await enable(cookie, service.id)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.path).toBe("/services/a")
    const page = (await findPage(body.pageId))!
    expect(page.serviceId).toBe(service.id)
    expect(page.status).toBe("draft")
    expect(page.draft.blocks).toHaveLength(7)
    expect((await findService(service.id)).pagePath).toBe("/services/a")
    expect(expired()).toEqual(
      expect.arrayContaining(["routes", "collection:services"])
    )
  })

  it("409s a second enable", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    expect((await enable(cookie, service.id)).status).toBe(201)
    expect((await enable(cookie, service.id)).status).toBe(409)
  })

  it("409s when no visible CTA band exists", async () => {
    const { service } = await setup({ band: false })
    const res = await enable(await cookieFor("editor"), service.id)
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe(
      "Add a call-to-action band first"
    )
  })

  it("404s an unknown service", async () => {
    await setup()
    const res = await enable(await cookieFor("editor"), crypto.randomUUID())
    expect(res.status).toBe(404)
  })

  it("forbids an author", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("author")
    expect((await enable(cookie, service.id)).status).toBe(403)
    expect((await disable(cookie, service.id)).status).toBe(403)
  })

  it("moves the page and leaves a redirect when the slug changes", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    await publish(cookie, pageId)
    next.revalidateTag.mockReset()
    expect((await patchService(cookie, service.id, { slug: "b" })).status).toBe(
      200
    )
    expect((await findPage(pageId))!.path).toBe("/services/b")
    expect((await findService(service.id)).pagePath).toBe("/services/b")
    const [redirect] = await getDb()
      .select()
      .from(redirects)
      .where(eq(redirects.sourcePath, "/services/a"))
    expect(redirect?.destination).toBe("/services/b")
    expect(expired()).toEqual(
      expect.arrayContaining([`page:${pageId}`, "routes", "redirects"])
    )
  })

  it("409s a slug change onto a taken address and moves nothing", async () => {
    const { asset, service } = await setup()
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    await insertPage({ path: "/services/b", document: heroDocument(asset.id) })
    const res = await patchService(cookie, service.id, { slug: "b" })
    expect(res.status).toBe(409)
    expect((await findPage(pageId))!.path).toBe("/services/a")
    const after = await findService(service.id)
    expect(after.slug).toBe("a")
    expect(after.pagePath).toBe("/services/a")
  })

  it("hides the page with its service", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    await publish(cookie, pageId)
    expect(await getPublishedPage("/services/a")).not.toBeNull()
    next.revalidateTag.mockReset()
    const res = await patchService(cookie, service.id, { isVisible: false })
    expect(res.status).toBe(200)
    expect(expired()).toEqual(
      expect.arrayContaining([`page:${pageId}`, "routes"])
    )
    expect(await getPublishedPage("/services/a")).toBeNull()
    const sitemap = (await getSitemapEntries()).map((e) => e.path)
    expect(sitemap).toContain("/services")
    expect(sitemap).not.toContain("/services/a")
    const llms = (await getLlmsEntries()).map((e) => e.path)
    expect(llms).not.toContain("/services/a")
    expect((await getRouteTable()).live).not.toContain("/services/a")

    await patchService(cookie, service.id, { isVisible: true })
    expect(await getPublishedPage("/services/a")).not.toBeNull()
    expect((await getRouteTable()).live).toContain("/services/a")
  })

  it("deleting the service deletes its page and revisions", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    await publish(cookie, pageId)
    const res = await adminRequest(
      `/collections/services/${service.id}`,
      cookie,
      {
        method: "DELETE",
      }
    )
    expect(res.status).toBe(200)
    expect(await findPage(pageId)).toBeUndefined()
    const left = await getDb()
      .select()
      .from(revisions)
      .where(eq(revisions.entityId, pageId))
    expect(left).toHaveLength(0)
  })

  it("disable removes the page and clears the link", async () => {
    const { service } = await setup()
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    await publish(cookie, pageId)
    next.revalidateTag.mockReset()
    expect((await disable(cookie, service.id)).status).toBe(204)
    expect(await findPage(pageId)).toBeUndefined()
    expect((await findService(service.id)).pagePath).toBe("")
    expect(
      await getDb()
        .select()
        .from(revisions)
        .where(eq(revisions.entityId, pageId))
    ).toHaveLength(0)
    expect(expired()).toEqual(
      expect.arrayContaining([
        `page:${pageId}`,
        "routes",
        "collection:services",
      ])
    )
    // It can be enabled again afterwards.
    expect((await enable(cookie, service.id)).status).toBe(201)
  })

  it("404s disabling a service without a page", async () => {
    const { service } = await setup()
    expect((await disable(await cookieFor("editor"), service.id)).status).toBe(
      404
    )
  })
})
