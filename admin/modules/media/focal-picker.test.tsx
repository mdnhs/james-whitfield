// @vitest-environment jsdom
import { fireEvent, render, screen } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"

import { FocalPicker } from "./focal-picker"

const item = {
  url: "/uploads/a.png",
  width: 200,
  height: 800,
  filename: "a.png",
}

afterEach(() => vi.restoreAllMocks())

describe("FocalPicker", () => {
  it("measures against the image box: a click at its centre is 0.5/0.5", () => {
    // A tall image: 100 × 400 rendered, inside a wider button.
    vi.spyOn(Element.prototype, "getBoundingClientRect").mockReturnValue({
      left: 100,
      top: 10,
      width: 100,
      height: 400,
      right: 200,
      bottom: 410,
      x: 100,
      y: 10,
      toJSON() {},
    })
    const onChange = vi.fn()
    render(
      <FocalPicker item={item} value={{ x: 0, y: 0 }} onChange={onChange} />
    )
    fireEvent.click(screen.getByRole("button"), {
      clientX: 150,
      clientY: 210,
      detail: 1,
    })
    expect(onChange).toHaveBeenCalledWith({ x: 0.5, y: 0.5 })
  })
  it("ignores keyboard-generated clicks and moves with arrows", () => {
    const onChange = vi.fn()
    render(
      <FocalPicker item={item} value={{ x: 0.5, y: 0.5 }} onChange={onChange} />
    )
    const button = screen.getByRole("button")
    fireEvent.click(button, { detail: 0 })
    expect(onChange).not.toHaveBeenCalled()
    fireEvent.keyDown(button, { key: "ArrowRight" })
    expect(onChange).toHaveBeenCalledWith({ x: 0.55, y: 0.5 })
  })
})
