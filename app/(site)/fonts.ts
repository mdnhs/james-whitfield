import {
  DM_Mono,
  Fraunces,
  Geist,
  IBM_Plex_Mono,
  Inter,
  Plus_Jakarta_Sans,
} from "next/font/google"

import { cn } from "@/lib/utils"

// No face is preloaded. CSS is inlined (next.config.ts), so the @font-face
// rules are known at the first style pass and the files start as early as a
// preload would; a preload only pushes ~170 KB ahead of the header image that
// is the LCP on every page (Lighthouse mobile LCP 3.1 s without, 4.6 s with).
// The home hero copy waits for the fonts anyway (HeroMotion reveals it after
// document.fonts.ready).
const inter = Inter({
  preload: false,
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
})

const geist = Geist({
  preload: false,
  subsets: ["latin"],
  variable: "--font-geist-sans",
  display: "swap",
})

const fraunces = Fraunces({
  preload: false,
  subsets: ["latin"],
  // No SOFT axis: every use sets 'SOFT' 0, the axis default, and the axis
  // alone is ~54 KB of the 121 KB file.
  axes: ["WONK", "opsz"],
  variable: "--font-fraunces",
  display: "swap",
})

const jakarta = Plus_Jakarta_Sans({
  preload: false,
  subsets: ["latin"],
  variable: "--font-plus-jakarta",
  display: "swap",
})

const dmMono = DM_Mono({
  preload: false,
  subsets: ["latin"],
  weight: "400",
  variable: "--font-dm-mono-family",
  display: "swap",
})

const plexMono = IBM_Plex_Mono({
  preload: false,
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
})

// Shared by the site root layout and global-not-found so both render the
// same fonts and base classes.
export const siteFontClassName = cn(
  "antialiased",
  geist.variable,
  fraunces.variable,
  jakarta.variable,
  dmMono.variable,
  plexMono.variable,
  "font-sans",
  inter.variable
)
