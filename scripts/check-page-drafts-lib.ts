import { kindOf, pageDocumentFor } from "@/blocks/page"

export type DraftRow = {
  path: string
  systemKey: string | null
  draft: unknown
}

// Every draft that publish would refuse (the same check publishPage runs),
// hidden blocks and anchors included, with each error as "<path>: <message>".
export function failingDrafts(rows: DraftRow[]) {
  return rows.flatMap((row) => {
    const parsed = pageDocumentFor(kindOf(row.systemKey)).safeParse(row.draft)
    if (parsed.success) return []
    const errors = parsed.error.issues.map(
      (issue) => `${issue.path.map(String).join(".") || "_"}: ${issue.message}`
    )
    return [{ path: row.path, systemKey: row.systemKey, errors }]
  })
}
