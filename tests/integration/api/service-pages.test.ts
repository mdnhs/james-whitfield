import { readFileSync } from "node:fs"

import { eq, sql } from "drizzle-orm"
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
  faqs,
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
    // Live straight away with the template's placeholder copy; the first
    // revision is that publish.
    expect(page.status).toBe("published")
    expect(page.published?.blocks).toHaveLength(7)
    expect(await getPublishedPage("/services/a")).not.toBeNull()
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

// Spec: a service already linked to a page by a hand-typed page_path keeps
// that link (migration 0016 backfills pages.service_id).
const BACKFILL = readFileSync(
  "server/db/migrations/0016_service_page_backfill.sql",
  "utf8"
)

async function legacySetup() {
  const base = await setup()
  await getDb()
    .update(services)
    .set({ pagePath: "/team" })
    .where(eq(services.id, base.service.id))
  const page = await insertPage({
    path: "/team",
    document: heroDocument(base.asset.id),
    published: true,
  })
  return { ...base, page }
}

describe("legacy linked services", () => {
  it("the backfill links a page at the service's page_path", async () => {
    const { service, page } = await legacySetup()
    // A system page at a page_path is never claimed.
    await getDb().insert(services).values({
      slug: "s",
      title: "S",
      body: "B",
      icon: "mind",
      pagePath: "/services",
    })
    await getDb().execute(sql.raw(BACKFILL))
    expect((await findPage(page.id))!.serviceId).toBe(service.id)
    const [system] = await getDb()
      .select()
      .from(pages)
      .where(eq(pages.path, "/services"))
    expect(system!.serviceId).toBeNull()
  })

  it("enable 409s and keeps a backfilled legacy link", async () => {
    const { service, page } = await legacySetup()
    await getDb().execute(sql.raw(BACKFILL))
    const cookie = await cookieFor("editor")
    const res = await enable(cookie, service.id)
    expect(res.status).toBe(409)
    expect((await res.json()).error.message).toBe(
      "This service already has a details page"
    )
    expect((await findService(service.id)).pagePath).toBe("/team")
    expect((await findPage(page.id))!.path).toBe("/team")
    expect(
      await getDb().select().from(pages).where(eq(pages.path, "/services/a"))
    ).toHaveLength(0)
  })

  // A page_path that names no page linked to this service is stale: the
  // switch must still turn on, or the editor is stuck.
  it.each([
    ["a system page", "/services"],
    ["an unlinked page", "/team"],
    ["nothing", "/nowhere"],
  ])("enable overwrites a stale page_path naming %s", async (_, stale) => {
    const { service } = await legacySetup()
    await getDb()
      .update(services)
      .set({ pagePath: stale })
      .where(eq(services.id, service.id))
    const res = await enable(await cookieFor("editor"), service.id)
    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.path).toBe("/services/a")
    expect((await findPage(body.pageId))!.serviceId).toBe(service.id)
    expect((await findService(service.id)).pagePath).toBe("/services/a")
  })

  it("enable overwrites a page_path naming another service's page", async () => {
    const { service, page } = await legacySetup()
    await getDb().execute(sql.raw(BACKFILL))
    const [other] = await getDb()
      .insert(services)
      .values({
        slug: "o",
        title: "Other",
        body: "B",
        icon: "mind",
        pagePath: "/team",
      })
      .returning()
    const res = await enable(await cookieFor("editor"), other!.id)
    expect(res.status).toBe(201)
    expect((await findService(other!.id)).pagePath).toBe("/services/o")
    expect((await findPage(page.id))!.serviceId).toBe(service.id)
  })

  it("disable deletes the linked legacy page", async () => {
    const { service, page } = await legacySetup()
    await getDb().execute(sql.raw(BACKFILL))
    expect((await disable(await cookieFor("editor"), service.id)).status).toBe(
      204
    )
    expect(await findPage(page.id)).toBeUndefined()
    expect((await findService(service.id)).pagePath).toBe("")
  })

  it("a slug change leaves a page outside /services/<slug> in place", async () => {
    const { service, page } = await legacySetup()
    await getDb().execute(sql.raw(BACKFILL))
    const cookie = await cookieFor("editor")
    expect((await patchService(cookie, service.id, { slug: "b" })).status).toBe(
      200
    )
    expect((await findPage(page.id))!.path).toBe("/team")
    expect((await findService(service.id)).pagePath).toBe("/team")
    expect(
      await getDb()
        .select()
        .from(redirects)
        .where(eq(redirects.sourcePath, "/team"))
    ).toHaveLength(0)
  })

  it("hide and delete reach the legacy page through its link", async () => {
    const { service, page } = await legacySetup()
    await getDb().execute(sql.raw(BACKFILL))
    const cookie = await cookieFor("editor")
    await patchService(cookie, service.id, { isVisible: false })
    expect(await getPublishedPage("/team")).toBeNull()
    expect((await getRouteTable()).live).not.toContain("/team")
    const res = await adminRequest(
      `/collections/services/${service.id}`,
      cookie,
      {
        method: "DELETE",
      }
    )
    expect(res.status).toBe(200)
    expect(await findPage(page.id)).toBeUndefined()
  })
})

describe("admin services list", () => {
  it("tells each service its detail page", async () => {
    const { service } = await setup()
    const [other] = await getDb()
      .insert(services)
      .values({ slug: "z", title: "Z", body: "B", icon: "mind" })
      .returning()
    await getDb().insert(faqs).values({ question: "Q?", answer: "A." })
    const cookie = await cookieFor("editor")
    const { pageId } = await (await enable(cookie, service.id)).json()
    const list = await (
      await adminRequest("/collections/services", cookie)
    ).json()
    const byId = new Map(
      list.items.map((i: { id: string }) => [i.id, i] as const)
    )
    expect(byId.get(service.id)).toMatchObject({
      detailPage: { id: pageId, path: "/services/a", status: "published" },
    })
    expect(byId.get(other!.id)).toMatchObject({ detailPage: null })
    const faqList = await (
      await adminRequest("/collections/faqs", cookie)
    ).json()
    expect(faqList.items).toHaveLength(1)
    expect(faqList.items[0]).not.toHaveProperty("detailPage")
  })
})

describe("automatic service pages", () => {
  const ensure = (cookie: string) =>
    adminRequest(`/service-pages/ensure`, cookie, { method: "POST" })
  const linked = async (serviceId: string) =>
    (
      await getDb().select().from(pages).where(eq(pages.serviceId, serviceId))
    )[0]

  it("creates every missing page once and reports nothing failed", async () => {
    const { service } = await setup()
    const [second] = await getDb()
      .insert(services)
      .values({ slug: "b", title: "Sleep", body: "Rest.", icon: "mind" })
      .returning()
    const cookie = await cookieFor("editor")
    const first = await ensure(cookie)
    expect(first.status).toBe(200)
    expect(await first.json()).toEqual({ created: 2, published: 0, failed: [] })
    expect((await linked(service.id))?.path).toBe("/services/a")
    expect((await linked(second!.id))?.status).toBe("published")
    // Idempotent: a second call creates nothing.
    expect(await (await ensure(cookie)).json()).toEqual({
      created: 0,
      published: 0,
      failed: [],
    })
  })

  it("publishes a service page that was never published", async () => {
    const { asset, service } = await setup()
    // A page made as a draft before pages went live on creation.
    const old = await insertPage({
      path: "/services/a",
      document: heroDocument(asset.id, "Old draft"),
      published: false,
    })
    await getDb()
      .update(pages)
      .set({ serviceId: service.id })
      .where(eq(pages.id, old.id))
    const res = await ensure(await cookieFor("editor"))
    expect(await res.json()).toEqual({ created: 0, published: 1, failed: [] })
    const page = (await findPage(old.id))!
    expect(page.status).toBe("published")
    expect(await getPublishedPage("/services/a")).not.toBeNull()
  })

  it("reports why a page could not be made", async () => {
    const { service } = await setup({ band: false })
    const res = await ensure(await cookieFor("editor"))
    expect(await res.json()).toEqual({
      created: 0,
      published: 0,
      failed: [
        { serviceId: service.id, message: "Add a call-to-action band first" },
      ],
    })
  })

  it("is refused without collection:create", async () => {
    await setup()
    expect((await ensure(await cookieFor("author"))).status).toBe(403)
  })

  it("adding a service creates its details page", async () => {
    await setup()
    const res = await adminRequest(
      "/collections/services",
      await cookieFor("editor"),
      {
        method: "POST",
        body: {
          values: {
            slug: "new-one",
            title: "New one",
            body: "Fresh.",
            icon: "mind",
            isVisible: true,
          },
        },
      }
    )
    expect(res.status).toBe(201)
    const { id } = await res.json()
    const page = await linked(id)
    expect(page?.path).toBe("/services/new-one")
    expect(page?.status).toBe("published")
  })
})
