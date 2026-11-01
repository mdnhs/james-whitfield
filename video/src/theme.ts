// Brand tokens copied from app/(site)/site.css so the video matches the site.
export const C = {
  cream: "#faf6f0",
  stone: "#f3f4ee",
  mint: "#d6e8e4",
  mist: "#d9e5e5",
  brand: "#336060",
  pine: "#1e4f50",
  spruce: "#002620",
  heroBase: "#0d120f",
  clay: "#b0513f",
  ink: "#0c0c0c",
  muted: "#525252",
  subtle: "#6e726d",
  line: "#dfe2d8",
}

export const FONT_DISPLAY = "Fraunces, Georgia, serif"
export const FONT_SANS = "Inter, Helvetica, Arial, sans-serif"

export const FPS = 30
export const WIDTH = 1920
export const HEIGHT = 1080
export const DURATION = 60 * FPS

// Scene timing in frames. Neighbouring scenes overlap by FADE frames so one
// cross-fades into the next.
export const FADE = 15
export const SCENES = {
  hook: { from: 0, duration: 195 },
  problem: { from: 180, duration: 285 },
  meet: { from: 450, duration: 255 },
  steps: { from: 690, duration: 465 },
  services: { from: 1140, duration: 375 },
  cta: { from: 1500, duration: 300 },
} as const
