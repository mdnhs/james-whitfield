import type { MediaAsset } from "@/lib/media"

// What the site draws for its logo: the uploaded image (or, with none, the
// built-in mark), replaced by the Lottie animation while it is switched on.
export type BrandLogo = {
  image: MediaAsset | null
  lottie: { src: string } | null
}

export const NO_BRAND_LOGO: BrandLogo = { image: null, lottie: null }
