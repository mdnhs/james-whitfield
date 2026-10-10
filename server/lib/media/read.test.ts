import { mkdtemp, mkdir, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"

import { describe, expect, it } from "vitest"

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
})
