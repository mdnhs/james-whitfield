import "server-only"

import {
  COLLECTION_SCHEMAS,
  type CollectionSlug,
} from "@/lib/content/collections"
import * as t from "@/server/db/schema"
import type { CollectionName } from "@/server/lib/cache"

// One generic router (docs/brief.md §8.3). Schema keys are the column names
// (camelCase), except images: the API speaks { mediaId } (the media widget),
// the table stores <column>Id. The shared columns (id, sort, is_visible,
// version, stamps) are typed through faqs; each collection's own shape is
// enforced by its Zod schema, and the seeded-rows test proves the mapping.
type Shared = typeof t.faqs
export type SharedInsert = Shared["$inferInsert"]
type Row = Record<string, unknown>
type Entry = {
  table: Shared
  // The cache tag the site's queries read (server/modules/content/queries.ts).
  tag: CollectionName
  titleKey: string
  image?: { field: string; column: string }
}
const as = (table: unknown) => table as Shared

const REGISTRY: Record<CollectionSlug, Entry> = {
  services: { table: as(t.services), tag: "services", titleKey: "title" },
  plans: { table: as(t.plans), tag: "plans", titleKey: "name" },
  testimonials: {
    table: as(t.testimonials),
    tag: "testimonials",
    titleKey: "authorName",
    image: { field: "avatar", column: "avatarId" },
  },
  faqs: { table: t.faqs, tag: "faqs", titleKey: "question" },
  steps: {
    table: as(t.processSteps),
    tag: "steps",
    titleKey: "title",
    image: { field: "image", column: "imageId" },
  },
  "cta-bands": {
    table: as(t.ctaBands),
    tag: "bands",
    titleKey: "name",
    image: { field: "image", column: "imageId" },
  },
}

export const entryFor = (name: CollectionSlug) => REGISTRY[name]

export function toRow(name: CollectionSlug, values: Row): Row {
  const { image } = REGISTRY[name]
  if (!image) return values
  const { [image.field]: ref, ...rest } = values
  return { ...rest, [image.column]: (ref as { mediaId: string }).mediaId }
}

export function fromRow(name: CollectionSlug, row: Row): Row {
  const { image } = REGISTRY[name]
  return Object.fromEntries(
    Object.keys(COLLECTION_SCHEMAS[name].shape).map((key) => [
      key,
      key === image?.field ? { mediaId: row[image.column] } : row[key],
    ])
  )
}

export const titleOf = (name: CollectionSlug, row: Row) =>
  String(row[REGISTRY[name].titleKey] ?? "")
