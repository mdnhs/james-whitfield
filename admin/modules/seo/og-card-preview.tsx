"use client"

import { useEffect, useRef, useState } from "react"

import { OG_SIZE } from "@/lib/seo/metadata"
import { OgCard, type OgColors, type OgSubject } from "@/lib/seo/og-card"

// The share card rendered in the browser, so it follows what is being typed
// and works for drafts the /og route cannot see. The real 1200x630 markup,
// scaled down to the width it is given.
export function OgCardPreview(props: OgSubject & { colors: OgColors }) {
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.3)
  useEffect(() => {
    const el = box.current
    if (!el || typeof ResizeObserver === "undefined") return
    const update = () => setScale(el.clientWidth / OG_SIZE.width)
    update()
    const observer = new ResizeObserver(update)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return (
    <div
      ref={box}
      role="img"
      aria-label="Share image preview"
      className="relative aspect-[1.91/1] w-full overflow-hidden"
    >
      <div
        aria-hidden="true"
        style={{
          width: OG_SIZE.width,
          height: OG_SIZE.height,
          transform: `scale(${scale})`,
          transformOrigin: "top left",
        }}
      >
        <OgCard {...props} />
      </div>
    </div>
  )
}
