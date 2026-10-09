// blocks/media-refs.ts
import type { MediaAsset } from "@/lib/media"

import type { BlockData, BlockType } from "./registry"

// Blocks and globals store images as { mediaId }. The renderer swaps every
// reference for its asset before a section sees the data.
export type Resolve<T> = T extends { mediaId: string }
  ? MediaAsset
  : T extends readonly (infer U)[]
    ? Resolve<U>[]
    : T extends object
      ? { [K in keyof T]: Resolve<T[K]> }
      : T

export type BlockView<T extends BlockType> = Resolve<BlockData<T>>

const isRef = (value: unknown): value is { mediaId: string } =>
  typeof value === "object" &&
  value !== null &&
  typeof (value as { mediaId?: unknown }).mediaId === "string"

export function collectMediaIds(value: unknown): string[] {
  const ids = new Set<string>()
  const walk = (node: unknown) => {
    if (isRef(node)) ids.add(node.mediaId)
    else if (Array.isArray(node)) node.forEach(walk)
    else if (node && typeof node === "object") Object.values(node).forEach(walk)
  }
  walk(value)
  return [...ids]
}

// A missing asset is a broken reference (Phase 4's delete guard prevents
// it); fail loudly rather than render an image with no source.
export function resolveMedia<T>(
  value: T,
  assets: ReadonlyMap<string, MediaAsset>
): Resolve<T> {
  const walk = (node: unknown): unknown => {
    if (isRef(node)) {
      const asset = assets.get(node.mediaId)
      if (!asset) throw new Error(`Media ${node.mediaId} is missing`)
      return asset
    }
    if (Array.isArray(node)) return node.map(walk)
    if (node && typeof node === "object") {
      return Object.fromEntries(
        Object.entries(node).map(([k, v]) => [k, walk(v)])
      )
    }
    return node
  }
  return walk(value) as Resolve<T>
}
