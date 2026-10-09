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

// The step media slot's shape (the design's 381.75 × 216 box).
export const STEP_SLOT_ASPECT = 381.75 / 216

type CropArea = { x: number; y: number; width: number; height: number }

// react-easy-crop gives the visible part of the image in percent of the
// image; the site stores where the whole image sits relative to the slot.
// `+ 0` turns -0 into 0.
export const cropAreaToFrame = (area: CropArea): StepFrame => {
  const w = 100 / area.width
  const h = 100 / area.height
  return {
    x: (-area.x / 100) * w + 0,
    y: (-area.y / 100) * h + 0,
    w,
    h,
  }
}

export const frameToCropArea = (frame: StepFrame): CropArea => ({
  x: (-frame.x / frame.w) * 100 + 0,
  y: (-frame.y / frame.h) * 100 + 0,
  width: 100 / frame.w,
  height: 100 / frame.h,
})
