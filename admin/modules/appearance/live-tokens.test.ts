// @vitest-environment jsdom
import { expect, it } from "vitest"

import { applyLive } from "./live-tokens"

it("sets every declaration and the cleanup removes only those", () => {
  const root = document.createElement("div")
  root.style.setProperty("--other", "1")
  const undo = applyLive(root, [
    ["--primary", "oklch(0.5 0.1 150)"],
    ["--radius", "0.5rem"],
  ])
  expect(root.style.getPropertyValue("--primary")).toBe("oklch(0.5 0.1 150)")
  undo()
  expect(root.style.getPropertyValue("--primary")).toBe("")
  expect(root.style.getPropertyValue("--radius")).toBe("")
  expect(root.style.getPropertyValue("--other")).toBe("1")
})

it("ignores a declaration name that is not a custom property", () => {
  const root = document.createElement("div")
  applyLive(root, [["color", "red"]])
  expect(root.style.getPropertyValue("color")).toBe("")
})
