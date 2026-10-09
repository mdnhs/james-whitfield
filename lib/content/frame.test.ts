import { describe, expect, it } from "vitest"

import { cropToFrame, frameStyle } from "./frame"

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
