import "server-only"

import type { BrandLogo } from "@/lib/brand"
import type { GlobalValue } from "@/lib/content/globals"
import { getMedia } from "@/server/modules/content/queries"

// Media keys are content-hashed: the hash versions the Lottie URL, so a new
// file is fetched fresh while an unchanged one stays cached.
const HASH = /\/([a-f0-9]{16})-[^/]*$/

export async function getBrandLogo(
  site: GlobalValue<"site">
): Promise<BrandLogo> {
  const lottieRef = site.logoLottieEnabled ? site.logoLottie : null
  const ids = [site.logo?.mediaId, lottieRef?.mediaId].filter(
    (id): id is string => Boolean(id)
  )
  const assets = ids.length ? await getMedia(ids) : null
  const image = (site.logo && assets?.get(site.logo.mediaId)) || null
  const animation = lottieRef ? assets?.get(lottieRef.mediaId) : undefined
  const version = animation
    ? (HASH.exec(animation.src)?.[1] ?? lottieRef!.mediaId)
    : null
  return {
    image,
    lottie: version ? { src: `/site-logo/lottie?v=${version}` } : null,
  }
}
