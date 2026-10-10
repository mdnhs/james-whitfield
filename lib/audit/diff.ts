// Before/after rows for the Activity log's detail view (docs/brief.md §9.3).
// Values are plain text: React escapes them, and nothing here builds markup.
export type DiffRow = { field: string; from: string; to: string }

const MAX = 2000

const clip = (text: string) =>
  text.length > MAX ? `${text.slice(0, MAX)}…` : text

function show(value: unknown): string {
  if (value === null || value === undefined) return "—"
  if (typeof value === "string") return clip(value)
  return clip(JSON.stringify(value, null, 2) ?? String(value))
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v)

export function diffRows(diff: unknown): DiffRow[] {
  if (!isRecord(diff)) return []
  return Object.keys(diff)
    .sort((a, b) => a.localeCompare(b))
    .map((field) => {
      const change = diff[field]
      if (!isRecord(change)) return { field, from: "—", to: show(change) }
      return { field, from: show(change.from), to: show(change.to) }
    })
}
