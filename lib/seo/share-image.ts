// docs/brief.md §11: uploaded share images are validated for size and ratio.
export const SHARE_IMAGE_MESSAGE = "Use an image at least 1200×630 (1.91:1)"

export function isShareImageSize({
  width,
  height,
}: {
  width: number
  height: number
}) {
  return (
    width >= 1200 && height >= 630 && Math.abs(width / height - 1.91) <= 0.05
  )
}
