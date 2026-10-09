import Image, { type ImageProps } from "next/image"

import type { MediaAsset } from "@/lib/media"

type Props = Omit<ImageProps, "src" | "alt" | "placeholder" | "blurDataURL"> & {
  media: MediaAsset
  // Static imports used placeholder="blur"; keep it where the design had it.
  blur?: boolean
  // Crop for this use only; otherwise the asset's own focal point.
  focal?: { x: number; y: number } | null
  alt?: string
}

const percent = (n: number) => `${Math.round(n * 10_000) / 100}%`

export function MediaImage({
  media,
  blur = false,
  focal,
  alt,
  fill,
  width,
  height,
  style,
  ...rest
}: Props) {
  const point = focal ?? media.focal
  const size = fill
    ? { fill: true }
    : { width: width ?? media.width, height: height ?? media.height }
  return (
    <Image
      src={media.src}
      alt={alt ?? media.alt}
      {...size}
      placeholder={blur && media.blurDataURL ? "blur" : "empty"}
      blurDataURL={media.blurDataURL ?? undefined}
      style={
        point
          ? {
              objectPosition: `${percent(point.x)} ${percent(point.y)}`,
              ...style,
            }
          : style
      }
      {...rest}
    />
  )
}
