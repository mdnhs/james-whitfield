export type GaugePart = {
  key: string
  label: string
  value: number
  tone: "solid" | "dark" | "hatched"
}

// `ratio` is the headline part's share of the total: the part whose key is
// `headlineKey`, or the first part when no key is given. An empty gauge (or
// an unknown key) has a ratio of 0, never NaN.
export function gaugeSummary(
  parts: readonly GaugePart[],
  headlineKey?: string
) {
  const clean = parts.map((part) => ({
    ...part,
    value: Number.isFinite(part.value) ? Math.max(0, part.value) : 0,
  }))
  const total = clean.reduce((sum, part) => sum + part.value, 0)
  const headline =
    headlineKey === undefined
      ? clean[0]
      : clean.find((part) => part.key === headlineKey)
  return {
    parts: clean,
    total,
    ratio: total === 0 ? 0 : (headline?.value ?? 0) / total,
  }
}

// Where the pill chart's floating value tag sits.
export function peakIndex(values: readonly number[]) {
  let best = -1
  values.forEach((value, index) => {
    if (best === -1 || value > values[best]!) best = index
  })
  return best
}
