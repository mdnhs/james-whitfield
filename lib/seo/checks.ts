import { isShareImageSize } from "./share-image"

export const TITLE_RANGE = [30, 60] as const
export const DESCRIPTION_RANGE = [70, 160] as const

export type CheckId =
  | "title-length"
  | "title-unique"
  | "description"
  | "og-image"
  | "alt-text"
  | "h1"
  | "indexable"
  | "internal-link"
export type CheckInput = {
  title: string
  titleUnique: boolean
  description: string | null
  // null: the generated 1200×630 card (always the right size).
  ogImage: { width: number; height: number } | null
  imagesMissingAlt: number
  hasH1: boolean
  noindex: boolean
  internalLinks: number
}
export type CheckResult = { id: CheckId; ok: boolean; message: string }

const within = (n: number, [min, max]: readonly [number, number]) =>
  n >= min && n <= max

// docs/brief.md §11 health checks; shared by the SEO center and the editors.
export function runChecks(i: CheckInput): CheckResult[] {
  const d = i.description?.length ?? 0
  return [
    {
      id: "title-length",
      ok: within(i.title.length, TITLE_RANGE),
      message: `Title is ${i.title.length} characters (aim for 30–60)`,
    },
    {
      id: "title-unique",
      ok: i.titleUnique,
      message: i.titleUnique
        ? "Title is unique"
        : "Another page has the same title",
    },
    {
      id: "description",
      ok: within(d, DESCRIPTION_RANGE),
      message: d
        ? `Description is ${d} characters (aim for 70–160)`
        : "Add a meta description",
    },
    {
      id: "og-image",
      ok: i.ogImage === null || isShareImageSize(i.ogImage),
      message:
        i.ogImage === null
          ? "Uses the generated share card"
          : isShareImageSize(i.ogImage)
            ? "Share image is the right size"
            : "Share image should be at least 1200×630 (1.91:1)",
    },
    {
      id: "alt-text",
      ok: i.imagesMissingAlt === 0,
      message:
        i.imagesMissingAlt === 0
          ? "Every image has alt text"
          : `${i.imagesMissingAlt} image${i.imagesMissingAlt === 1 ? "" : "s"} missing alt text`,
    },
    {
      id: "h1",
      ok: i.hasH1,
      message: i.hasH1 ? "Has a main heading" : "No main heading (H1)",
    },
    {
      id: "indexable",
      ok: !i.noindex,
      message: i.noindex
        ? "Hidden from search engines"
        : "Visible to search engines",
    },
    {
      id: "internal-link",
      ok: i.internalLinks > 0,
      message:
        i.internalLinks > 0
          ? `${i.internalLinks} internal link${i.internalLinks === 1 ? "" : "s"}`
          : "No links to other pages on this site",
    },
  ]
}
