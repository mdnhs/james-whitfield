import type { StepFrame } from "./types"

const fraction = (value: string) => Number.parseFloat(value) / 100
// Two decimals, as the design's crop boxes were written.
const percent = (n: number) => `${Math.round(n * 10_000) / 100}%`

// The fixtures' "%"-string crop boxes become fractions in the database
// (docs/brief.md §6.3, process_steps.frame).
export const cropToFrame = (crop: {
  left: string
  top: string
  width: string
  height: string
}): StepFrame => ({
  x: fraction(crop.left),
  y: fraction(crop.top),
  w: fraction(crop.width),
  h: fraction(crop.height),
})

export const frameStyle = (frame: StepFrame) => ({
  left: percent(frame.x),
  top: percent(frame.y),
  width: percent(frame.w),
  height: percent(frame.h),
})
