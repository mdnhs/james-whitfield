// Ruling R13: the favicon and app icons rasterised from the library icon.
export const ICON_SIZES = [32, 180, 192, 512] as const

// FNV-1a: a short, stable cache-buster that changes when the file does.
export function iconVersion(src: string): string {
  let hash = 0x811c9dc5
  for (let i = 0; i < src.length; i++) {
    hash ^= src.charCodeAt(i)
    hash = Math.imul(hash, 0x01000193) >>> 0
  }
  return hash.toString(16).padStart(8, "0")
}

export const iconHref = (size: number, version: string) =>
  `/site-icon/${size}?v=${version}`
