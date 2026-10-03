import Image from "next/image"

import heroBg from "@/public/images/hero/hero-bg.png"
import { HeroWebGL } from "./hero-webgl"

// Rotated (19.55deg) left-side shade, stacked three times as in the design.
// Stops are in px so the layer can extend past the 1140.9px design box
// (solid on the left, transparent on the right) without visible edges.
const SHADE =
  "linear-gradient(to left, rgba(0,0,0,0) 0px, rgba(0,0,0,0.4) 1140.9px)"

export function HeroBackground() {
  return (
    <div aria-hidden data-hero="bg" className="absolute inset-0">
      <div
        // Design: 1585x1058 image layer at top -31px inside a 1440x810 frame.
        className="absolute top-[-3.83%] left-0 h-[130.62%] w-[110.07%] bg-black"
      >
        {/* Inner layer takes the intro zoom and pointer drift. */}
        <div data-hero="bg-image" className="absolute inset-0">
          <Image
            src={heroBg}
            alt=""
            fill
            preload
            placeholder="blur"
            sizes="110vw"
            className="-scale-x-100 object-cover"
          />
          <HeroWebGL />
          <div className="absolute inset-0 bg-black/30" />
        </div>
      </div>

      {/* Shade stays locked to the 1440px content column so it always sits
          behind the copy, whatever the viewport width. */}
      <div className="absolute inset-y-0 left-1/2 w-full max-w-360 -translate-x-1/2">
        <div className="absolute top-[362.8px] left-[362.7px] h-[1151.6px] w-[1140.9px] -translate-x-1/2 -translate-y-1/2 rotate-[19.55deg]">
          <div
            className="absolute inset-y-[-2000px] right-0 left-[-2000px]"
            style={{ backgroundImage: `${SHADE}, ${SHADE}, ${SHADE}` }}
          />
        </div>
      </div>

      {/* Bottom fade keeps the copy legible now that it sits at the bottom. */}
      <div className="absolute inset-x-0 bottom-0 h-3/5 bg-linear-to-t from-black/60 via-black/25 to-transparent" />
    </div>
  )
}
