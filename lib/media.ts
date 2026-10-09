// lib/media.ts
// What a section needs to draw an image. Built from a `media` row by the
// content repo; blocks store only { mediaId } (blocks/media-refs.ts).
export type MediaAsset = {
  id: string | null
  src: string
  width: number
  height: number
  blurDataURL: string | null
  alt: string
  focal: { x: number; y: number } | null
}

// Transitional (Tasks 4–9): pages still feed sections from fixtures, which
// hold public paths. Sections that use it either `fill` or pass their own
// width/height. Removed in Task 10.
export const fromPath = (src: string): MediaAsset => ({
  id: null,
  src,
  width: 0,
  height: 0,
  blurDataURL: null,
  alt: "",
  focal: null,
})
