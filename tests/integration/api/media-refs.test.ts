import { mkdtemp } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

import sharp from "sharp"
import {
  afterAll,
  beforeAll,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest"

vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: vi.fn(),
}))

import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"
import { resetEnvForTests } from "@/server/env"
import { resetStorageForTests } from "@/server/lib/media/storage"

import { adminRequest, cookieFor, ORIGIN } from "../helpers/auth"
import { heroDocument, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

beforeAll(async () => {
  process.env.MEDIA_DRIVER = "local"
  process.env.MEDIA_LOCAL_DIR = await mkdtemp(join(tmpdir(), "mk-refs-"))
  resetEnvForTests()
  resetStorageForTests()
})
beforeEach(resetDb)
afterAll(closeDb)

async function uploadImage(cookie: string) {
  const form = new FormData()
  const png = await sharp({
    create: {
      width: 16,
      height: 16,
      channels: 3,
      background: {
        r: Math.floor(Math.random() * 256),
        g: Math.floor(Math.random() * 256),
        b: Math.floor(Math.random() * 256),
      },
    },
  })
    .png()
    .toBuffer()
  form.set("file", new File([new Uint8Array(png)], "a.png"))
  const response = await app.request("/api/v1/admin/media", {
    method: "POST",
    headers: { cookie, origin: ORIGIN },
    body: form,
  })
  return (await response.json()).id as string
}

async function deletedMedia(cookie: string) {
  const id = await uploadImage(cookie)
  const response = await adminRequest(`/media/${id}`, cookie, {
    method: "DELETE",
  })
  expect(response.status).toBe(200)
  return id
}

// A deleted image and a uuid that never existed must both be a 400 naming the
// id; neither a 500 (FK) nor a silent save.
async function expectRejected(response: Response, id: string) {
  expect(response.status).toBe(400)
  const body = await response.json()
  expect(body.error.code).toBe("VALIDATION_FAILED")
  expect(JSON.stringify(body.error.fieldErrors)).toContain(id)
}

const unknownId = () => crypto.randomUUID()
const testimonial = (avatarId: string) => ({
  quote: "Lovely",
  authorName: "Sam",
  authorRole: "Client",
  avatar: { mediaId: avatarId },
  isVisible: true,
})

describe.each(["deleted", "unknown"] as const)("%s media refs", (kind) => {
  const pick = async (cookie: string) =>
    kind === "deleted" ? deletedMedia(cookie) : unknownId()

  it("globals PUT → 400", async () => {
    const cookie = await cookieFor("editor")
    const id = await pick(cookie)
    const current = await (
      await adminRequest("/globals/newsletter", cookie)
    ).json()
    const response = await adminRequest("/globals/newsletter", cookie, {
      method: "PUT",
      body: {
        version: current.version,
        value: { ...current.value, image: { mediaId: id } },
      },
    })
    await expectRejected(response, id)
  })

  it("collection create → 400", async () => {
    const cookie = await cookieFor("editor")
    const id = await pick(cookie)
    const response = await adminRequest("/collections/testimonials", cookie, {
      method: "POST",
      body: { values: testimonial(id) },
    })
    await expectRejected(response, id)
  })

  it("collection update → 400", async () => {
    const cookie = await cookieFor("editor")
    const live = await uploadImage(cookie)
    const created = await (
      await adminRequest("/collections/testimonials", cookie, {
        method: "POST",
        body: { values: testimonial(live) },
      })
    ).json()
    const id = await pick(cookie)
    const response = await adminRequest(
      `/collections/testimonials/${created.id}`,
      cookie,
      {
        method: "PATCH",
        body: {
          version: created.version,
          values: { avatar: { mediaId: id } },
        },
      }
    )
    await expectRejected(response, id)
  })

  it("page SEO share image → 400", async () => {
    const cookie = await cookieFor("editor")
    const id = await pick(cookie)
    const page = await insertPage({
      path: "/team",
      document: heroDocument(await uploadImage(cookie)),
    })
    const response = await adminRequest(`/pages/${page.id}/seo`, cookie, {
      method: "PATCH",
      body: { seo: { ogImage: { mediaId: id } } },
    })
    await expectRejected(response, id)
  })
})

describe("restoring a global", () => {
  it("refuses a revision whose image was deleted since", async () => {
    const cookie = await cookieFor("editor")
    const id = await uploadImage(cookie)
    const current = await (
      await adminRequest("/globals/newsletter", cookie)
    ).json()
    const saved = await adminRequest("/globals/newsletter", cookie, {
      method: "PUT",
      body: {
        version: current.version,
        value: { ...current.value, image: { mediaId: id } },
      },
    })
    expect(saved.status).toBe(200)
    const { version } = await saved.json()
    // Replace the image so the first revision is no longer in use, then
    // delete the file.
    const cleared = await adminRequest("/globals/newsletter", cookie, {
      method: "PUT",
      body: { version, value: { ...current.value, image: null } },
    })
    expect(cleared.status).toBe(200)
    expect(
      (await adminRequest(`/media/${id}`, cookie, { method: "DELETE" })).status
    ).toBe(200)

    const { items } = await (
      await adminRequest("/globals/newsletter/revisions", cookie)
    ).json()
    const withImage = items.find(
      (item: { version: number }) => item.version === version
    )
    const response = await adminRequest(
      `/globals/newsletter/revisions/${withImage.id}/restore`,
      cookie,
      { method: "POST", body: { version: (await cleared.json()).version } }
    )
    await expectRejected(response, id)
  })
})
