import { describe, expect, it } from "vitest"

import type { MediaAsset } from "@/lib/media"

import {
  depthToRgba,
  fitSize,
  focusFromDepth,
  heroBackgroundPlan,
} from "./background"

const asset = (over: Partial<MediaAsset> = {}): MediaAsset => ({
  id: "m1",
  src: "/uploads/photo.jpg",
  width: 1600,
  height: 900,
  blurDataURL: null,
  alt: "",
  focal: null,
  ...over,
})

describe("heroBackgroundPlan", () => {
  it("keeps the bundled scene when the background is unset or missing", () => {
    expect(heroBackgroundPlan(undefined)).toEqual({ kind: "default" })
    expect(heroBackgroundPlan(null)).toEqual({ kind: "default" })
    expect(heroBackgroundPlan({ image: null, depth: null })).toEqual({
      kind: "default",
    })
    // A depth map without its photo means nothing.
    expect(heroBackgroundPlan({ image: null, depth: asset() })).toEqual({
      kind: "default",
    })
  })

  it("uses the custom photo, its focal point and its depth map", () => {
    const image = asset({ focal: { x: 0.25, y: 0.75 } })
    const depth = asset({ id: "d1", src: "/uploads/depth.png" })
    expect(heroBackgroundPlan({ image, depth })).toEqual({
      kind: "custom",
      image,
      depth,
      align: { x: 0.25, y: 0.25 },
    })
  })

  it("centres a photo with no focal point and allows a missing depth map", () => {
    const image = asset()
    expect(heroBackgroundPlan({ image, depth: null })).toEqual({
      kind: "custom",
      image,
      depth: null,
      align: { x: 0.5, y: 0.5 },
    })
  })
})

describe("focusFromDepth", () => {
  // RGBA pixels whose red channel is `value(x, y)`.
  const rgba = (
    w: number,
    h: number,
    value: (x: number, y: number) => number
  ) => {
    const data = new Uint8ClampedArray(w * h * 4)
    for (let y = 0; y < h; y++)
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4
        data[i] = data[i + 1] = data[i + 2] = value(x, y)
        data[i + 3] = 255
      }
    return data
  }

  it("is the median depth of the centre region, 0..1", () => {
    // Centre (x, y in 3..6 of 10) is 102; the border is far (0) or near (255).
    const data = rgba(10, 10, (x, y) =>
      x >= 3 && x < 7 && y >= 3 && y < 7 ? 102 : x < 5 ? 0 : 255
    )
    expect(focusFromDepth(data, 10, 10)).toBeCloseTo(0.4, 5)
  })

  it("ignores outliers in the centre (median, not mean)", () => {
    const data = rgba(10, 10, (x, y) => (x === 5 && y === 5 ? 255 : 51))
    expect(focusFromDepth(data, 10, 10)).toBeCloseTo(0.2, 5)
  })

  it("reads single-channel data", () => {
    const data = new Uint8Array(16).fill(204)
    expect(focusFromDepth(data, 4, 4, { stride: 1 })).toBeCloseTo(0.8, 5)
  })

  it("falls back to mid depth for an empty map", () => {
    expect(focusFromDepth(new Uint8Array(0), 0, 0)).toBe(0.5)
  })
})

describe("depthToRgba", () => {
  it("stretches any range to 0..255 gray, larger (nearer) brighter", () => {
    const out = depthToRgba(new Float32Array([2, 4, 6, 3]), 2, 2)
    expect([...out]).toEqual([
      0, 0, 0, 255, 128, 128, 128, 255, 255, 255, 255, 255, 64, 64, 64, 255,
    ])
  })

  it("reads the first channel of multi-channel data", () => {
    const out = depthToRgba(new Uint8Array([0, 9, 9, 100, 9, 9]), 2, 1, 3)
    expect([...out]).toEqual([0, 0, 0, 255, 255, 255, 255, 255])
  })

  it("is mid gray for a flat map", () => {
    expect([...depthToRgba([7, 7], 2, 1)]).toEqual([
      128, 128, 128, 255, 128, 128, 128, 255,
    ])
  })
})

describe("fitSize", () => {
  it("caps the long edge and keeps the aspect", () => {
    expect(fitSize(4000, 3000, 1024)).toEqual({ width: 1024, height: 768 })
    expect(fitSize(900, 1600, 1024)).toEqual({ width: 576, height: 1024 })
  })
  it("never upscales and refuses an empty image", () => {
    expect(fitSize(640, 480, 1024)).toEqual({ width: 640, height: 480 })
    expect(fitSize(0, 480)).toEqual({ width: 0, height: 0 })
  })
})
