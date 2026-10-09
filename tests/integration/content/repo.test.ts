import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import {
  ctaBands,
  faqs,
  media,
  pages,
  services,
  settings,
  testimonials,
} from "@/server/db/schema"
import {
  findCtaBand,
  findPageByPath,
  findSetting,
  listFaqs,
  listServices,
  listTestimonials,
} from "@/server/modules/content/repo"

import { resetDb } from "../helpers/db"

beforeEach(resetDb)
afterAll(closeDb)

const MEDIA_ID = "00000000-0000-4000-8000-000000000001"
const doc = (title: string) => ({
  blocks: [
    {
      id: "about-home",
      type: "hero.page" as const,
      anchor: "home",
      chapter: "Welcome",
      hidden: false,
      joinPrevious: false,
      data: {
        title,
        subtitle: "S",
        image: { mediaId: MEDIA_ID },
        focal: null,
        tint: 0.32,
        mirror: false,
      },
    },
  ],
})

// A row the write path would reject (hand-edited, or from another schema).
const corrupt = (document: unknown) =>
  document as (typeof pages.$inferInsert)["published"]

describe("content repo", () => {
  it("serves the published document, or the draft in draft mode", async () => {
    await getDb()
      .insert(pages)
      .values({
        path: "/about",
        title: "About",
        status: "published",
        draft: doc("Draft"),
        published: doc("Live"),
      })
    const live = await findPageByPath("/about", { draft: false })
    const draft = await findPageByPath("/about", { draft: true })
    expect(live?.document.blocks[0].data).toMatchObject({ title: "Live" })
    expect(draft?.document.blocks[0].data).toMatchObject({ title: "Draft" })
    expect(live?.settings).toEqual({
      showContactChapter: true,
      needsReview: false,
    })
  })

  it("drops an invalid block and keeps the rest of the page", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const valid = doc("Live").blocks[0]
    await getDb()
      .insert(pages)
      .values({
        path: "/about",
        title: "About",
        status: "published",
        draft: doc("Draft"),
        published: corrupt({
          blocks: [
            valid,
            { ...valid, id: "about-bogus", type: "no.such", anchor: "bogus" },
            { ...valid, id: "about-bad", anchor: "bad", data: { title: 1 } },
          ],
        }),
      })
    const page = await findPageByPath("/about", { draft: false })
    expect(page?.document.blocks.map((b) => b.id)).toEqual(["about-home"])
    expect(warn).toHaveBeenCalledTimes(2)
    warn.mockRestore()
  })

  it("treats a page whose blocks are all invalid as missing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    await getDb()
      .insert(pages)
      .values({
        path: "/broken",
        title: "Broken",
        status: "published",
        draft: doc("Draft"),
        published: corrupt({ blocks: [{ id: "x-bogus", type: "no.such" }] }),
      })
    expect(await findPageByPath("/broken", { draft: false })).toBeNull()
    warn.mockRestore()
  })

  it("treats an unpublished page as missing", async () => {
    await getDb()
      .insert(pages)
      .values({ path: "/privacy", title: "Privacy", draft: doc("Draft") })
    expect(await findPageByPath("/privacy", { draft: false })).toBeNull()
    expect(await findPageByPath("/nope", { draft: false })).toBeNull()
  })

  it("hides an unpublished page that still holds published JSON", async () => {
    await getDb()
      .insert(pages)
      .values({
        path: "/old",
        title: "Old",
        status: "draft",
        draft: doc("Draft"),
        published: doc("Was live"),
      })
    expect(await findPageByPath("/old", { draft: false })).toBeNull()
    expect(await findPageByPath("/old", { draft: true })).not.toBeNull()
  })

  it("lists visible collection rows in sort order", async () => {
    await getDb()
      .insert(services)
      .values([
        { slug: "b", title: "B", body: "b", icon: "sleep", sort: 2 },
        { slug: "a", title: "A", body: "a", icon: "anxiety", sort: 1 },
        {
          slug: "c",
          title: "C",
          body: "c",
          icon: "habits",
          sort: 0,
          isVisible: false,
        },
      ])
    expect((await listServices()).map((s) => s.slug)).toEqual(["a", "b"])
    await getDb().insert(faqs).values({ question: "Q", answer: "A" })
    expect(await listFaqs()).toHaveLength(1)
  })

  it("reads a setting row", async () => {
    await getDb()
      .insert(settings)
      .values({ key: "site", value: { name: "Magda Kennedy" } })
    expect((await findSetting("site"))?.value).toEqual({
      name: "Magda Kennedy",
    })
    expect(await findSetting("footer")).toBeNull()
  })

  it("keeps the media id stable for references", async () => {
    await getDb().insert(media).values({
      id: MEDIA_ID,
      driver: "static",
      key: "/images/x.png",
      url: "/images/x.png",
      filename: "x.png",
      mimeType: "image/png",
      sizeBytes: 1,
    })
    const [row] = await getDb().select().from(media)
    expect(row.id).toBe(MEDIA_ID)
  })

  it("skips rows whose image was soft-deleted instead of failing", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {})
    const asset = (key: string) => ({
      driver: "static" as const,
      key,
      url: key,
      filename: "x.png",
      mimeType: "image/png",
      sizeBytes: 1,
    })
    const [kept, gone] = await getDb()
      .insert(media)
      .values([asset("/images/kept.png"), asset("/images/gone.png")])
      .returning()
    await getDb()
      .update(media)
      .set({ deletedAt: new Date() })
      .where(eq(media.id, gone.id))
    await getDb()
      .insert(testimonials)
      .values([
        { quote: "Q1", authorName: "A", authorRole: "R", avatarId: kept.id },
        { quote: "Q2", authorName: "B", authorRole: "R", avatarId: gone.id },
      ])
    const [band] = await getDb()
      .insert(ctaBands)
      .values({
        name: "n",
        eyebrow: "e",
        title: "t",
        cta: { label: "l", href: "/contact" },
        imageId: gone.id,
      })
      .returning()
    expect((await listTestimonials()).map((r) => r.quote)).toEqual(["Q1"])
    expect(await findCtaBand(band.id)).toBeNull()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining(gone.id))
    warn.mockRestore()
  })
})
