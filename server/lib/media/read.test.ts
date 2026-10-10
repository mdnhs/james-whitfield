import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it, vi } from "vitest"

import { readMediaBytes } from "./read"

describe("readMediaBytes", () => {
  it("reads a static file from public/", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pub-"))
    await mkdir(path.join(dir, "images"), { recursive: true })
    await writeFile(path.join(dir, "images/a.svg"), "<svg/>")
    const bytes = await readMediaBytes(
      { driver: "static", key: "static/a", url: "/images/a.svg" },
      dir
    )
    expect(bytes?.toString()).toBe("<svg/>")
  })

  it("refuses a static path that climbs out of public/", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "pub-"))
    for (const url of ["/../etc/passwd", "/images/../../x", "images/a.svg"])
      expect(
        await readMediaBytes({ driver: "static", key: "k", url }, dir)
      ).toBeNull()
  })

  it("returns null for a missing file instead of throwing", async () => {
    expect(
      await readMediaBytes({
        driver: "static",
        key: "k",
        url: "/images/nope.png",
      })
    ).toBeNull()
  })

  describe("s3 driver", () => {
    const file = {
      driver: "s3" as const,
      key: "k",
      url: "https://cdn.test/a.png",
    }
    afterEach(() => vi.unstubAllGlobals())

    it("refuses redirects", async () => {
      const fetchMock = vi.fn(async () => new Response("ok"))
      vi.stubGlobal("fetch", fetchMock)
      await readMediaBytes(file)
      expect(fetchMock.mock.calls[0]).toEqual([
        file.url,
        expect.objectContaining({ redirect: "error" }),
      ])
    })

    it("rejects a declared oversize body without reading it", async () => {
      vi.stubGlobal(
        "fetch",
        async () =>
          new Response("x", {
            headers: { "content-length": String(21 * 1024 * 1024) },
          })
      )
      expect(await readMediaBytes(file)).toBeNull()
    })

    it("stops a stream that exceeds the cap", async () => {
      const chunk = new Uint8Array(1024 * 1024)
      let sent = 0
      const body = new ReadableStream<Uint8Array>({
        pull(c) {
          sent++
          c.enqueue(chunk)
          if (sent > 100) c.close()
        },
      })
      vi.stubGlobal("fetch", async () => new Response(body))
      expect(await readMediaBytes(file)).toBeNull()
      expect(sent).toBeLessThan(40)
    })

    it("returns the bytes of a small body", async () => {
      vi.stubGlobal("fetch", async () => new Response("abc"))
      expect((await readMediaBytes(file))?.toString()).toBe("abc")
    })
  })
})
