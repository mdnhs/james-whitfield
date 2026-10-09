import { mkdtemp, readFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { crc32 } from "node:zlib"

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

const next = vi.hoisted(() => ({ revalidateTag: vi.fn() }))
vi.mock("next/cache", async (importOriginal) => ({
  ...(await importOriginal<typeof import("next/cache")>()),
  revalidateTag: next.revalidateTag,
}))

import { GET as serveUpload } from "@/app/uploads/[...key]/route"
import { app } from "@/server/api/app"
import { closeDb } from "@/server/db/client"
import { resetEnvForTests } from "@/server/env"
import { resetStorageForTests } from "@/server/lib/media/storage"

import { gpsJpeg } from "../../support/gps-jpeg"
import { adminRequest, cookieFor, ORIGIN } from "../helpers/auth"
import { heroDocument, insertPage } from "../helpers/content"
import { resetDb } from "../helpers/db"

let dir = ""
beforeAll(async () => {
  dir = await mkdtemp(join(tmpdir(), "mk-media-"))
  process.env.MEDIA_DRIVER = "local"
  process.env.MEDIA_LOCAL_DIR = dir
  resetEnvForTests()
  resetStorageForTests()
})
beforeEach(async () => {
  await resetDb()
  next.revalidateTag.mockReset()
})
afterAll(closeDb)

const upload = (
  cookie: string,
  body: Buffer,
  filename: string,
  path = "/media"
) => {
  const form = new FormData()
  form.set("file", new File([new Uint8Array(body)], filename))
  return app.request(`/api/v1/admin${path}`, {
    method: "POST",
    headers: { cookie, origin: ORIGIN },
    body: form,
  })
}
const png = () =>
  sharp({
    create: { width: 64, height: 48, channels: 3, background: "#3366aa" },
  })
    .png()
    .toBuffer()

describe("media API", () => {
  // Acceptance: a 15 MB camera JPEG with GPS uploads, and the stored file
  // carries no EXIF at all.
  it("strips GPS and every other EXIF tag on upload", async () => {
    const input = await gpsJpeg()
    expect(input.length).toBeGreaterThanOrEqual(15 * 1024 * 1024)
    expect(input.length).toBeLessThan(20 * 1024 * 1024)
    expect((await sharp(input).metadata()).exif).toBeDefined()

    const response = await upload(
      await cookieFor("editor"),
      input,
      "IMG_0001.JPG"
    )
    expect(response.status).toBe(201)
    const item = await response.json()
    expect(item).toMatchObject({
      mimeType: "image/jpeg",
      width: 4000,
      height: 3000,
    })
    expect(item.url).toMatch(
      /^\/uploads\/media\/\d{4}\/\d{2}\/[a-f0-9]{16}-img-0001\.jpg$/
    )
    const stored = await readFile(join(dir, item.url.replace("/uploads/", "")))
    expect((await sharp(stored).metadata()).exif).toBeUndefined()
    expect(next.revalidateTag.mock.calls.map(([t]) => t)).toContain("media")
  })

  it("refuses SVG and oversize files", async () => {
    const cookie = await cookieFor("editor")
    const svg = await upload(
      cookie,
      Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>"),
      "x.jpg"
    )
    expect(svg.status).toBe(400)
    const huge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(22 * 1024 * 1024),
    ])
    expect((await upload(cookie, huge, "huge.jpg")).status).toBe(413)
  })

  // Review Focus 2: authors edit only what they uploaded.
  it("lets an author edit only their own media", async () => {
    const editor = await cookieFor("editor")
    const author = await cookieFor("author")
    const theirs = await (await upload(editor, await png(), "a.png")).json()
    const mine = await (
      await upload(author, await png(), "b-different.png")
    ).json()
    const patch = (cookie: string, id: string) =>
      adminRequest(`/media/${id}`, cookie, {
        method: "PATCH",
        body: { alt: "A calm room" },
      })
    expect((await patch(author, mine.id)).status).toBe(200)
    expect((await patch(author, theirs.id)).status).toBe(403)
    expect((await patch(await cookieFor("marketer"), theirs.id)).status).toBe(
      200
    )
  })

  it("replaces the file but keeps the id", async () => {
    const cookie = await cookieFor("editor")
    const item = await (await upload(cookie, await png(), "a.png")).json()
    const other = await sharp({
      create: { width: 80, height: 40, channels: 3, background: "#aa3366" },
    })
      .png()
      .toBuffer()
    const replaced = await (
      await upload(cookie, other, "new.png", `/media/${item.id}/replace`)
    ).json()
    expect(replaced.id).toBe(item.id)
    expect(replaced.url).not.toBe(item.url)
    expect(replaced.width).toBe(80)
  })

  it("guards deletion while the image is in use", async () => {
    const cookie = await cookieFor("editor")
    const used = await (await upload(cookie, await png(), "used.png")).json()
    await insertPage({ path: "/team", document: heroDocument(used.id) })
    const blocked = await adminRequest(`/media/${used.id}`, cookie, {
      method: "DELETE",
    })
    expect(blocked.status).toBe(409)
    expect((await blocked.json()).error.details.usage[0]).toMatchObject({
      kind: "page",
      label: "Test page",
    })
    const usage = await (
      await adminRequest(`/media/${used.id}/usage`, cookie)
    ).json()
    expect(usage.items).toHaveLength(1)
  })

  it.each([
    ["viewer", 403],
    ["intake", 403],
    ["author", 200],
  ] as const)("GET /media as %s → %i", async (role, status) => {
    expect((await adminRequest("/media", await cookieFor(role))).status).toBe(
      status
    )
  })
})

// A PNG whose header claims a canvas far past the pixel limit: tiny on the
// wire, gigabytes once decoded.
async function pixelBomb() {
  const out = Buffer.from(await png())
  out.writeUInt32BE(30000, 16)
  out.writeUInt32BE(30000, 20)
  out.writeUInt32BE(crc32(out.subarray(12, 29)) >>> 0, 29)
  return out
}

const serve = (key: string) =>
  serveUpload(new Request(`http://localhost/uploads/${key}`), {
    params: Promise.resolve({ key: key.split("/") }),
  })

describe("media security", () => {
  it("refuses files whose bytes are not a readable allowed type", async () => {
    const cookie = await cookieFor("editor")
    // JPEG magic bytes on a PNG body; a JPEG header followed by HTML.
    const mixed = Buffer.concat([Buffer.from([0xff, 0xd8, 0xff]), await png()])
    const html = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
      Buffer.from("<script>alert(1)</script>"),
    ])
    for (const body of [mixed, html, await pixelBomb()]) {
      expect((await upload(cookie, body, "x.png")).status).toBe(400)
    }
  })

  it("auto-orients, downscales past 4000 px and handles every allowed type", async () => {
    const cookie = await cookieFor("editor")
    const rotated = await sharp({
      create: { width: 40, height: 20, channels: 3, background: "#123456" },
    })
      .jpeg()
      .withMetadata({ orientation: 6 })
      .toBuffer()
    expect(await (await upload(cookie, rotated, "r.jpg")).json()).toMatchObject(
      { width: 20, height: 40 }
    )
    const wide = await sharp({
      create: { width: 5000, height: 100, channels: 3, background: "#123456" },
    })
      .png()
      .toBuffer()
    expect(await (await upload(cookie, wide, "w.png")).json()).toMatchObject({
      width: 4000,
      height: 80,
    })
    const webp = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#123456" },
    })
      .webp()
      .toBuffer()
    expect(await (await upload(cookie, webp, "a.webp")).json()).toMatchObject({
      mimeType: "image/webp",
    })
    const avif = await sharp({
      create: { width: 8, height: 8, channels: 3, background: "#123456" },
    })
      .avif()
      .toBuffer()
    expect(await (await upload(cookie, avif, "a.avif")).json()).toMatchObject({
      mimeType: "image/avif",
    })
    const pdf = await upload(
      cookie,
      Buffer.from("%PDF-1.4\n%%EOF\n"),
      "Brochure.pdf"
    )
    expect(pdf.status).toBe(201)
    expect(await pdf.json()).toMatchObject({
      mimeType: "application/pdf",
      width: null,
    })
  })

  it("never trusts the client's filename as a path", async () => {
    const item = await (
      await upload(
        await cookieFor("editor"),
        await png(),
        "../../etc/Pass wd.png"
      )
    ).json()
    expect(item.filename).toBe("Pass wd.png")
    expect(item.url).toMatch(/\/[a-f0-9]{16}-pass-wd\.png$/)
  })

  it("lets an author replace only their own media, and audits writes", async () => {
    const theirs = await (
      await upload(await cookieFor("editor"), await png(), "a.png")
    ).json()
    const author = await cookieFor("author")
    expect(
      (
        await upload(
          author,
          await png(),
          "b.png",
          `/media/${theirs.id}/replace`
        )
      ).status
    ).toBe(403)
    const audit = await (
      await adminRequest("/audit?entityType=media", await cookieFor("owner"))
    ).json()
    expect(JSON.stringify(audit)).toContain("media.upload")
  })

  it("keeps the 1 MB limit on every other admin request", async () => {
    const cookie = await cookieFor("editor")
    const item = await (await upload(cookie, await png(), "a.png")).json()
    const big = await adminRequest(`/media/${item.id}`, cookie, {
      method: "PATCH",
      body: { alt: "x".repeat(2 * 1024 * 1024) },
    })
    expect(big.status).toBe(413)
  })

  it("serves only well-formed stored keys, with a fixed type and nosniff", async () => {
    const item = await (
      await upload(await cookieFor("editor"), await png(), "a.png")
    ).json()
    const ok = await serve(item.url.replace("/uploads/", ""))
    expect(ok.status).toBe(200)
    expect(ok.headers.get("content-type")).toBe("image/png")
    expect(ok.headers.get("x-content-type-options")).toBe("nosniff")
    expect(ok.headers.get("content-security-policy")).toContain("sandbox")
    for (const key of [
      "media",
      "media/2026/10",
      "../../etc/passwd",
      "media/2026/10/0123456789abcdef-none.png",
    ]) {
      expect((await serve(key)).status).toBe(404)
    }
  })
})

describe("media fixes", () => {
  it("strips XMP, IPTC and the ICC profile as well as EXIF", async () => {
    const xmp =
      '<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"/></x:xmpmeta>'
    const input = await sharp({
      create: { width: 32, height: 32, channels: 3, background: "#336699" },
    })
      .withIccProfile("p3")
      .withXmp(xmp)
      .withExif({ IFD0: { Make: "Test" } })
      .jpeg()
      .toBuffer()
    const before = await sharp(input).metadata()
    expect(before.xmp).toBeDefined()
    expect(before.icc).toBeDefined()
    const item = await (
      await upload(await cookieFor("editor"), input, "meta.jpg")
    ).json()
    const after = await sharp(
      await readFile(join(dir, item.url.replace("/uploads/", "")))
    ).metadata()
    for (const field of ["exif", "xmp", "iptc", "icc"] as const) {
      expect(after[field]).toBeUndefined()
    }
    expect(after.hasProfile).toBe(false)
  })

  it("refuses a 20–21 MB file with 413 after the body limit lets it through", async () => {
    const body = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(20.5 * 1024 * 1024),
    ])
    const response = await upload(await cookieFor("editor"), body, "big.jpg")
    expect(response.status).toBe(413)
    expect((await response.json()).error.message).toBe(
      "Files can be up to 20 MB"
    )
  })

  it("deletes unused media: soft delete, audit, gone from the library", async () => {
    const editor = await cookieFor("editor")
    const item = await (await upload(editor, await png(), "gone.png")).json()
    const deleted = await adminRequest(`/media/${item.id}`, editor, {
      method: "DELETE",
    })
    expect(deleted.status).toBe(200)
    expect(await deleted.json()).toEqual({ ok: true })
    expect(
      (await (await adminRequest(`/media?ids=${item.id}`, editor)).json()).items
    ).toEqual([])
    expect((await adminRequest(`/media/${item.id}/usage`, editor)).status).toBe(
      404
    )
    const audit = await (
      await adminRequest("/audit?entityType=media", await cookieFor("owner"))
    ).json()
    expect(JSON.stringify(audit)).toContain("media.delete")
    expect(next.revalidateTag.mock.calls.map(([t]) => t)).toContain("media")
  })

  it("reuses a duplicate only when it is live and the uploader may edit it", async () => {
    const editor = await cookieFor("editor")
    const author = await cookieFor("author")
    const bytes = await png()
    const first = await (await upload(editor, bytes, "same.png")).json()
    // Same uploader, or a role that edits every file: the existing row.
    expect((await (await upload(editor, bytes, "same.png")).json()).id).toBe(
      first.id
    )
    expect(
      (
        await (
          await upload(await cookieFor("marketer"), bytes, "same.png")
        ).json()
      ).id
    ).toBe(first.id)
    // An author gets a row of their own, which they can then edit.
    const authors = await (await upload(author, bytes, "same.png")).json()
    expect(authors.id).not.toBe(first.id)
    expect(authors.url).not.toBe(first.url)
    const patch = await adminRequest(`/media/${authors.id}`, author, {
      method: "PATCH",
      body: { alt: "Mine" },
    })
    expect(patch.status).toBe(200)
    // A soft-deleted row is never brought back.
    await adminRequest(`/media/${first.id}`, editor, { method: "DELETE" })
    const again = await (await upload(editor, bytes, "same.png")).json()
    expect(again.id).not.toBe(first.id)
    expect(again).toMatchObject({ alt: "" })
    expect((await serve(again.url.replace("/uploads/", ""))).status).toBe(200)
  })

  it("replaces with bytes that match a soft-deleted file", async () => {
    const editor = await cookieFor("editor")
    const bytes = await png()
    const old = await (await upload(editor, bytes, "old.png")).json()
    await adminRequest(`/media/${old.id}`, editor, { method: "DELETE" })
    const other = await sharp({
      create: { width: 10, height: 10, channels: 3, background: "#000" },
    })
      .png()
      .toBuffer()
    const item = await (await upload(editor, other, "item.png")).json()
    const replaced = await upload(
      editor,
      bytes,
      "old.png",
      `/media/${item.id}/replace`
    )
    expect(replaced.status).toBe(200)
    expect((await replaced.json()).id).toBe(item.id)
  })

  it("serves PDFs as attachments, keeping nosniff and the sandbox", async () => {
    const pdf = await (
      await upload(
        await cookieFor("editor"),
        Buffer.from("%PDF-1.4\n%%EOF\n"),
        "Price List.pdf"
      )
    ).json()
    const response = await serve(pdf.url.replace("/uploads/", ""))
    expect(response.headers.get("content-type")).toBe("application/pdf")
    expect(response.headers.get("content-disposition")).toBe(
      'attachment; filename="price-list.pdf"'
    )
    expect(response.headers.get("x-content-type-options")).toBe("nosniff")
    expect(response.headers.get("content-security-policy")).toContain("sandbox")
  })
})
