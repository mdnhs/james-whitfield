import Image, { getImageProps } from "next/image"

import { MediaImage } from "@/components/media-image"
import { servedAsIs, type MediaAsset } from "@/lib/media"
import heroBg from "@/public/images/hero/hero-bg.png"
import { heroBackgroundPlan, type HeroBackgroundValue } from "../lib/background"
import { HeroWebGL } from "./hero-webgl"

// Rotated (19.55deg) left-side shade, stacked three times as in the design.
// Stops are in px so the layer can extend past the 1140.9px design box
// (solid on the left, transparent on the right) without visible edges.
const SHADE =
  "linear-gradient(to left, rgba(0,0,0,0) 0px, rgba(0,0,0,0.4) 1140.9px)"

// The depth map as a same-origin URL (the optimizer proxies remote media),
// so WebGL and the focus read can use its pixels. Quality 90: compression
// noise in a depth map reads as wobble.
function depthUrl(depth: MediaAsset) {
  if (servedAsIs(depth.src)) return depth.src
  return getImageProps({
    src: depth.src,
    alt: "",
    width: depth.width,
    height: depth.height,
    quality: 90,
  }).props.src
}

export function HeroBackground({
  background,
}: {
  background?: HeroBackgroundValue
}) {
  const plan = heroBackgroundPlan(background)
  return (
    <div aria-hidden data-hero="bg" className="absolute inset-0">
      <div className="absolute inset-0 bg-black">
        {/* Inner layer takes the intro zoom and pointer drift. */}
        <div data-hero="bg-image" className="absolute inset-0">
          {plan.kind === "default" ? (
            <>
              <Image
                src={heroBg}
                alt=""
                fill
                priority
                fetchPriority="high"
                placeholder="blur"
                sizes="100vw"
                style={{ objectPosition: "center 48%" }}
                className="-scale-x-100 object-cover"
              />
              <HeroWebGL />
            </>
          ) : (
            <>
              {/* The CMS photo, framed by its focal point, unmirrored. */}
              <MediaImage
                media={plan.image}
                alt=""
                fill
                priority
                fetchPriority="high"
                blur
                sizes="100vw"
                className="object-cover"
              />
              <HeroWebGL
                photo={{ src: plan.image.src }}
                depthSrc={plan.depth ? depthUrl(plan.depth) : undefined}
                scene={false}
                align={plan.align}
              />
            </>
          )}
          <div className="absolute inset-0 bg-black/30" />
        </div>
      </div>

      {/* Shade stays locked to the 1440px content column so it always sits
          behind the copy, whatever the viewport width. */}
      <div className="absolute inset-y-0 left-1/2 hidden w-full max-w-360 -translate-x-1/2 sm:block">
        <div className="absolute top-[362.8px] left-[362.7px] h-[1151.6px] w-[1140.9px] -translate-x-1/2 -translate-y-1/2 rotate-[19.55deg]">
          <div
            className="absolute inset-y-[-2000px] right-0 left-[-2000px]"
            style={{ backgroundImage: `${SHADE}, ${SHADE}, ${SHADE}` }}
          />
        </div>
      </div>

      {/* Bottom fade keeps the copy legible now that it sits at the bottom. */}
      <div className="absolute inset-x-0 bottom-0 hidden h-3/5 bg-linear-to-t from-black/60 via-black/25 to-black/0 sm:block" />

      {/* Mobile: the design's single top-to-bottom teal overlay instead. */}
      <div
        className="absolute inset-0 sm:hidden"
        style={{
          backgroundImage:
            "linear-gradient(180deg, rgba(5,26,26,0.55) 0%, rgba(5,26,26,0) 22%, rgba(5,31,31,0.1) 42%, rgba(8,38,38,0.88) 78%, rgba(8,38,38,0.96) 100%)",
        }}
      />
    </div>
  )
}
