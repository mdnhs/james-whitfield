import type { StatValue } from "@/lib/count"

export const count = (value: number, suffix = "", decimals = 0): StatValue => ({
  kind: "count",
  value,
  decimals,
  prefix: "",
  suffix,
})
