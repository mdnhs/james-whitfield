import { afterAll, beforeEach, describe, expect, it } from "vitest"

import { closeDb, getDb } from "@/server/db/client"
import { faqs, media, pages, services, settings } from "@/server/db/schema"
import {
  findPageByPath,
  findSetting,
  listFaqs,
  listServices,
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

describe("content repo", () => {
  it("serves the published document, or the draft in draft mode", async () => {
    await getDb()
      .insert(pages)
      .values({
        path: "/about",
        title: "About",
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

  it("treats an unpublished page as missing", async () => {
    await getDb()
      .insert(pages)
      .values({ path: "/privacy", title: "Privacy", draft: doc("Draft") })
    expect(await findPageByPath("/privacy", { draft: false })).toBeNull()
    expect(await findPageByPath("/nope", { draft: false })).toBeNull()
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
})
