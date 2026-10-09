// Counters are stored as numbers plus formatting (docs/brief.md §5.7), so
// "4.9/5" and "1,200+" count up correctly instead of parsing a leading integer.
export type CountStat = {
  kind: "count"
  value: number
  decimals: number
  prefix: string
  suffix: string
}
export type TextStat = { kind: "text"; text: string }
export type StatValue = CountStat | TextStat

const formatters = new Map<number, Intl.NumberFormat>()

export function formatCount(value: number, decimals: number) {
  let format = formatters.get(decimals)
  if (!format) {
    format = new Intl.NumberFormat("en-IE", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    formatters.set(decimals, format)
  }
  return format.format(value)
}

export function statText(stat: StatValue) {
  if (stat.kind === "text") return stat.text
  return `${stat.prefix}${formatCount(stat.value, stat.decimals)}${stat.suffix}`
}

// Read by PageMotion's count-up; text stats do not animate.
export function countAttrs(stat: StatValue): Record<string, string> {
  if (stat.kind === "text") return {}
  return {
    "data-motion": "count",
    "data-count-value": String(stat.value),
    "data-count-decimals": String(stat.decimals),
    "data-count-prefix": stat.prefix,
    "data-count-suffix": stat.suffix,
  }
}
