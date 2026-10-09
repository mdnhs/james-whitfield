// blocks/media-refs.test.ts
import { describe, expect, it } from "vitest"

import type { MediaAsset } from "@/lib/media"

import { collectMediaIds, resolveMedia } from "./media-refs"

const A = "00000000-0000-4000-8000-00000000000a"
const asset: MediaAsset = {
  id: A,
  src: "/images/a.png",
  width: 10,
  height: 20,
  blurDataURL: null,
  alt: "",
  focal: { x: 0.5, y: 0.5 },
}

describe("media references", () => {
  const data = {
    image: { mediaId: A },
    list: [{ avatar: { mediaId: A } }],
    title: "T",
  }

  it("collects each id once, at any depth", () => {
    expect(collectMediaIds(data)).toEqual([A])
  })
  it("swaps references for assets and leaves the rest", () => {
    expect(resolveMedia(data, new Map([[A, asset]]))).toEqual({
      image: asset,
      list: [{ avatar: asset }],
      title: "T",
    })
  })
  it("fails loudly on a missing asset", () => {
    expect(() => resolveMedia(data, new Map())).toThrow(/Media .* is missing/)
  })
})
