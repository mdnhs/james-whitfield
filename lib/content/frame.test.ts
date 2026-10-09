import { describe, expect, it } from "vitest"

import {
  cropAreaToFrame,
  cropToFrame,
  frameStyle,
  frameToCropArea,
} from "./frame"

describe("step frames", () => {
  it("round-trips today's hand-tuned crop boxes exactly", () => {
    for (const crop of [
      { left: "-11%", top: "-25.93%", width: "135.17%", height: "159.26%" },
      { left: "0.07%", top: "-8.8%", width: "100.07%", height: "117.59%" },
      { left: "0%", top: "0%", width: "113.16%", height: "133.33%" },
    ]) {
      expect(frameStyle(cropToFrame(crop))).toEqual(crop)
    }
  })
})

describe("cropper ↔ frame", () => {
  // react-easy-crop reports the visible part of the image in percent; the
  // site places the whole image relative to the slot.
  it("turns a centred half crop into a doubled, shifted image box", () => {
    expect(cropAreaToFrame({ x: 25, y: 25, width: 50, height: 50 })).toEqual({
      x: -0.5,
      y: -0.5,
      w: 2,
      h: 2,
    })
  })
  it("round-trips a seeded frame", () => {
    const frame = { x: -0.11, y: -0.2593, w: 1.3517, h: 1.5926 }
    const back = cropAreaToFrame(frameToCropArea(frame))
    for (const key of ["x", "y", "w", "h"] as const)
      expect(back[key]).toBeCloseTo(frame[key], 4)
  })
})
