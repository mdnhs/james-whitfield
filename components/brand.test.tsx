// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it, vi } from "vitest"

import { Brand } from "./brand"

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

const asset = (src: string) => ({
  id: "m1",
  src,
  width: 200,
  height: 200,
  blurDataURL: null,
  alt: "",
  focal: null,
})

it("keeps today's mark when no logo is set (parity)", () => {
  const { container } = render(<Brand name="Magda Kennedy" />)
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo-mark.svg"
  )
  expect(screen.getByText("Magda Kennedy")).toBeTruthy()
})

it("draws the library logo when one is set", () => {
  const { container } = render(
    <Brand
      name="Magda Kennedy"
      logo={{ image: asset("/uploads/logo.png"), lottie: null }}
    />
  )
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo.png"
  )
})

it("keeps the still logo on screen while the Lottie logo loads", () => {
  // Never resolves: the animation is still on its way.
  vi.stubGlobal("fetch", () => new Promise(() => {}))
  vi.stubGlobal("matchMedia", () => ({ matches: false }))
  const { container } = render(
    <Brand
      name="Magda Kennedy"
      logo={{
        image: asset("/uploads/logo.png"),
        lottie: { src: "/site-logo/lottie?v=abc" },
      }}
    />
  )
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo.png"
  )
  expect(container.querySelector("[aria-hidden]")).toBeTruthy()
})
