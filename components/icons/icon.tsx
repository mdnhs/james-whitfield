import type { IconName } from "@/lib/icons"

import { CONTENT_ICONS } from "./content-icons"

// Content icons are inline SVG painted with currentColor, so the colour comes
// from the surrounding text colour (and from the theme, Phase 9).
export function Icon({
  name,
  className,
  width,
  height,
}: {
  name: IconName
  className?: string
  width?: number
  height?: number
}) {
  const { Svg, width: w, height: h } = CONTENT_ICONS[name]
  return (
    <Svg
      aria-hidden
      focusable="false"
      className={className}
      width={width ?? w}
      height={height ?? h}
    />
  )
}
