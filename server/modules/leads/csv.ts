import "server-only"

// Formula injection (OWASP CSV injection): a leading = + - @ tab or CR turns
// the cell into text with a leading apostrophe. Every cell is quoted.
const FORMULA = /^[=+\-@\t\r]/

function cell(value: unknown) {
  const text =
    value == null
      ? ""
      : value instanceof Date
        ? value.toISOString()
        : String(value)
  const safe = FORMULA.test(text) ? `'${text}` : text
  return `"${safe.replaceAll('"', '""')}"`
}

export function toCsv(
  rows: Record<string, unknown>[],
  columns: { key: string; label: string }[]
) {
  const header = columns.map((c) => c.label).join(",")
  const body = rows.map((row) => columns.map((c) => cell(row[c.key])).join(","))
  return [header, ...body].join("\r\n")
}
