import { eq } from "drizzle-orm"
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest"

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { ROLE_NAMES, type RoleName } from "@/lib/auth/permissions"
import { COLLECTION_NAMES, COLLECTION_SCHEMAS } from "@/lib/content/collections"
import { closeDb, getDb } from "@/server/db/client"
import { faqs } from "@/server/db/schema"
import { seedContent } from "@/server/db/seed"
import { listItems } from "@/server/modules/collections/service"

import { adminRequest, cookieFor } from "../helpers/auth"
import { insertMedia, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const expired = () => next.revalidateTag.mock.calls.map(([tag]) => tag)
const faq = (question: string) => ({
  question,
  answer: "An answer.",
  isVisible: true,
})
const create = (cookie: string, name: string, values: unknown) =>
  adminRequest(`/collections/${name}`, cookie, {
    method: "POST",
    body: { values },
  })

const MATRIX: Record<RoleName, { read: number; write: number }> = {
  owner: { read: 200, write: 201 },
  admin: { read: 200, write: 201 },
  editor: { read: 200, write: 201 },
  author: { read: 200, write: 403 },
  marketer: { read: 200, write: 403 },
  intake: { read: 403, write: 403 },
  viewer: { read: 200, write: 403 },
}

describe.each(ROLE_NAMES)("collections RBAC for %s", (role) => {
  it(`GET → ${MATRIX[role].read}, POST → ${MATRIX[role].write}`, async () => {
    const cookie = await cookieFor(role)
    expect((await adminRequest("/collections/faqs", cookie)).status).toBe(
      MATRIX[role].read
    )
    expect((await create(cookie, "faqs", faq("Q?"))).status).toBe(
      MATRIX[role].write
    )
  })
})

describe("collections API", () => {
  it("creates, updates with a version, and 409s a stale one", async () => {
    const cookie = await cookieFor("editor")
    const item = await (await create(cookie, "faqs", faq("First?"))).json()
    expect(expired()).toEqual(["collection:faqs"])
    const patch = (version: number, question: string) =>
      adminRequest(`/collections/faqs/${item.id}`, cookie, {
        method: "PATCH",
        body: { version, values: { question } },
      })
    expect((await patch(1, "Second?")).status).toBe(200)
    const stale = await patch(1, "Third?")
    expect(stale.status).toBe(409)
    expect((await stale.json()).error.details.current.version).toBe(2)
  })

  // Review Focus 1: the slug is "cta-bands", the tag getCtaBand reads is
  // collection:bands.
  it("cta-bands writes expire collection:bands and validate the CTA link", async () => {
    const cookie = await cookieFor("editor")
    const asset = await insertMedia()
    const band = {
      name: "Next step",
      eyebrow: "Work with me",
      title: "Ready?",
      bullets: ["One"],
      cta: { label: "Book", href: "javascript:alert(1)" },
      image: { mediaId: asset.id },
      tint: 0.9,
      isVisible: true,
    }
    expect((await create(cookie, "cta-bands", band)).status).toBe(400)
    const ok = await create(cookie, "cta-bands", {
      ...band,
      cta: { label: "Book", href: "/contact" },
    })
    expect(ok.status).toBe(201)
    expect(expired()).toEqual(["collection:bands"])
  })

  it("reorders only with the complete id list", async () => {
    const cookie = await cookieFor("editor")
    const a = await (await create(cookie, "faqs", faq("A?"))).json()
    const b = await (await create(cookie, "faqs", faq("B?"))).json()
    const order = (ids: string[]) =>
      adminRequest("/collections/faqs/order", cookie, {
        method: "PATCH",
        body: { ids },
      })
    expect((await order([b.id])).status).toBe(400)
    expect((await order([b.id, a.id])).status).toBe(200)
    const { items } = await (
      await adminRequest("/collections/faqs", cookie)
    ).json()
    expect(items.map((i: { id: string }) => i.id)).toEqual([b.id, a.id])
  })

  it("blocks deleting a row a page names, and says where", async () => {
    const cookie = await cookieFor("editor")
    const used = await (await create(cookie, "faqs", faq("Used?"))).json()
    const free = await (await create(cookie, "faqs", faq("Free?"))).json()
    await insertPage({
      path: "/team",
      document: {
        blocks: [
          {
            id: "team-faq",
            type: "faq",
            anchor: "faq",
            chapter: null,
            hidden: false,
            joinPrevious: false,
            data: {
              variant: "page",
              title: "T",
              subtitle: "S",
              selection: { mode: "chosen", ids: [used.id] },
              initiallyOpen: null,
            },
          },
        ],
      },
    })
    const blocked = await adminRequest(`/collections/faqs/${used.id}`, cookie, {
      method: "DELETE",
    })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.details.usedOn).toEqual(["Test page"])
    expect(
      (
        await adminRequest(`/collections/faqs/${free.id}`, cookie, {
          method: "DELETE",
        })
      ).status
    ).toBe(200)
  })

  // P3 carries: seeded rows obey the write schemas, and a re-seed never
  // resurrects what an editor deleted.
  it("validates every seeded row and never re-seeds a seeded database", async () => {
    await seedContent()
    for (const name of COLLECTION_NAMES) {
      for (const item of (await listItems(name)).items) {
        const result = COLLECTION_SCHEMAS[name].safeParse(item.values)
        expect(result.success, `${name} ${item.title}`).toBe(true)
      }
    }
    const cookie = await cookieFor("editor")
    const { items } = await (
      await adminRequest("/collections/faqs", cookie)
    ).json()
    const unused =
      items.find((i: { usedOn: string[] }) => i.usedOn.length === 0) ?? items[0]
    await getDb().delete(faqs).where(eq(faqs.id, unused.id))
    expect(await seedContent()).toEqual({ skipped: true })
    const after = await (await adminRequest("/collections/faqs", cookie)).json()
    expect(after.items).toHaveLength(items.length - 1)
  })
})
