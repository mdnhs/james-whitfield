const NUMBER = new Intl.NumberFormat("en-IE")
const PERCENT = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 0,
})
const CHANGE = new Intl.NumberFormat("en-IE", {
  style: "percent",
  maximumFractionDigits: 1,
  signDisplay: "exceptZero",
})
const RELATIVE = new Intl.RelativeTimeFormat("en-IE", { numeric: "auto" })

export const formatNumber = (n: number) => NUMBER.format(n)
export const formatPercent = (ratio: number) => PERCENT.format(ratio)

// A part's share of a whole, rounded down so it never reads 100% while any
// of the whole is missing (199 of 200 is 99%, not 100%). With nothing to
// measure it is "—", not an alarming 0%.
export function formatShare(part: number, total: number) {
  if (!(total > 0)) return "—"
  return PERCENT.format(Math.floor((part * 100) / total) / 100)
}

export type Delta = { label: string; direction: "up" | "down" | "flat" }

// The KPI caption's "+3.4%". Without a baseline there is no honest
// percentage, so the caller shows the caption alone.
export function formatDelta(current: number, previous: number): Delta | null {
  if (previous === 0) {
    return current === 0 ? { label: "No change", direction: "flat" } : null
  }
  const change = (current - previous) / previous
  if (Math.abs(change) < 0.0005)
    return { label: "No change", direction: "flat" }
  return { label: CHANGE.format(change), direction: change > 0 ? "up" : "down" }
}

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 31_536_000],
  ["month", 2_592_000],
  ["week", 604_800],
  ["day", 86_400],
  ["hour", 3_600],
  ["minute", 60],
]

// `now` is passed in so server and browser render the same words.
export function relativeTime(iso: string, now: number) {
  const seconds = Math.round((Date.parse(iso) - now) / 1000)
  if (Math.abs(seconds) < 45) return "just now"
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) {
      return RELATIVE.format(Math.round(seconds / size), unit)
    }
  }
  return RELATIVE.format(Math.round(seconds / 60), "minute")
}
