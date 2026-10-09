export type GaugePart = {
  key: string
  label: string
  value: number
  tone: "solid" | "dark" | "hatched"
}

// The gauge's centred percentage is the first segment's share.
export function gaugeSummary(parts: readonly GaugePart[]) {
  const clean = parts.map((part) => ({
    ...part,
    value: Number.isFinite(part.value) ? Math.max(0, part.value) : 0,
  }))
  const total = clean.reduce((sum, part) => sum + part.value, 0)
  return {
    parts: clean,
    total,
    ratio: total === 0 ? 0 : (clean[0]?.value ?? 0) / total,
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
