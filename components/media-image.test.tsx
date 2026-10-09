// @vitest-environment jsdom
import { render } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import type { MediaAsset } from "@/lib/media"

import { MediaImage } from "./media-image"

const media: MediaAsset = {
  id: "m1",
  src: "/images/contact/contact-hero.png",
  width: 1600,
  height: 900,
  blurDataURL: "data:image/webp;base64,AAAA",
  alt: "The clinic room",
  focal: { x: 0.5, y: 0.5 },
}

describe("MediaImage", () => {
  it("maps the focal point to object-position (a per-use focal wins)", () => {
    const { container } = render(
      <MediaImage
        media={media}
        focal={{ x: 0.5, y: 0.38 }}
        fill
        sizes="100vw"
      />
    )
    expect(container.querySelector("img")!.style.objectPosition).toBe("50% 38%")
  })
  it("uses the asset's alt and size unless overridden", () => {
    const { container } = render(
      <MediaImage media={media} width={56} height={56} alt="" />
    )
    const img = container.querySelector("img")!
    expect(img.getAttribute("alt")).toBe("")
    expect(img.getAttribute("width")).toBe("56")
  })
  it("adds the blur placeholder only when asked", () => {
    const plain = render(<MediaImage media={media} fill sizes="100vw" />)
    expect(plain.container.querySelector("img")!.style.backgroundImage).toBe("")
    const blurred = render(<MediaImage media={media} fill sizes="100vw" blur />)
    expect(
      blurred.container.querySelector("img")!.style.backgroundImage
    ).toContain("data:image")
  })
})
