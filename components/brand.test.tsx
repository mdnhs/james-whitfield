// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react"
import { afterEach, expect, it } from "vitest"

import { Brand } from "./brand"

afterEach(cleanup)

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
    <Brand name="Magda Kennedy" logo={asset("/uploads/logo.png")} />
  )
  expect(container.querySelector("img")?.getAttribute("src")).toContain(
    "logo.png"
  )
})
