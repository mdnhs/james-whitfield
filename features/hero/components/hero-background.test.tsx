// @vitest-environment jsdom
import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import type { MediaAsset } from "@/lib/media"

import { HeroBackground } from "./hero-background"

// Vitest has no Next image loader: stand in for the static import.
vi.mock("@/public/images/hero/hero-bg.png", () => ({
  default: {
    src: "/_next/static/media/hero-bg.png",
    width: 2400,
    height: 1600,
    blurDataURL: "data:image/png;base64,AAAA",
  },
}))

const webgl = vi.fn()
vi.mock("./hero-webgl", () => ({
  HeroWebGL: (props: unknown) => {
    webgl(props)
    return null
  },
}))

const asset = (over: Partial<MediaAsset>): MediaAsset => ({
  id: "m1",
  src: "/uploads/field.jpg",
  width: 1600,
  height: 900,
  blurDataURL: null,
  alt: "Field",
  focal: { x: 0.3, y: 0.6 },
  ...over,
})

afterEach(() => {
  cleanup()
  webgl.mockClear()
})

describe("HeroBackground", () => {
  it("keeps the bundled photo, mirrored, and the full scene when unset", () => {
    for (const background of [undefined, { image: null, depth: null }]) {
      const { container } = render(<HeroBackground background={background} />)
      const img = container.querySelector("img")!
      expect(img.getAttribute("src")).toMatch(/hero-bg/)
      expect(img.className).toContain("-scale-x-100")
      expect(img.style.objectPosition).toBe("center 48%")
      expect(webgl).toHaveBeenLastCalledWith({})
      cleanup()
    }
  })

  it("shows the CMS photo at its focal point with depth parallax only", () => {
    const image = asset({})
    const depth = asset({ id: "d1", src: "/uploads/field-depth.png" })
    const { container } = render(
      <HeroBackground background={{ image, depth }} />
    )
    const img = container.querySelector("img")!
    expect(img.getAttribute("src")).toMatch(/field\.jpg/)
    expect(img.className).not.toContain("-scale-x-100")
    expect(img.style.objectPosition).toBe("30% 60%")
    expect(img.getAttribute("fetchpriority")).toBe("high")
    expect(webgl).toHaveBeenCalledWith({
      photo: { src: "/uploads/field.jpg" },
      depthSrc: expect.stringMatching(/field-depth\.png/),
      scene: false,
      align: { x: 0.3, y: expect.closeTo(0.4, 5) },
    })
  })

  it("passes no depth map when it is not built yet", () => {
    render(<HeroBackground background={{ image: asset({}), depth: null }} />)
    expect(webgl).toHaveBeenCalledWith(
      expect.objectContaining({ depthSrc: undefined, scene: false })
    )
  })
})
