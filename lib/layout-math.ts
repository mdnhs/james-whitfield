// The steps pin was tuned by hand for four cards: 24% of the pinned scroll
// per card and a 260svh spacer. Deriving both from the count keeps the same
// pace per card for any 3–6 steps, and gives back exactly the tuned values
// at four.
export function stepsTimeline(count: number) {
  const beat = 96 / count
  return {
    beat,
    spacer: `${65 * count}svh`,
    surface: (i: number) => ({ start: (i - 1) * beat + 8, end: i * beat + 4 }),
  }
}

// Left column first: the reading order the hand-split data used to encode.
export function splitColumns<T>(items: T[], columns: number): T[][] {
  const size = Math.ceil(items.length / columns)
  const result: T[][] = []
  for (let i = 0; i < items.length; i += size) {
    result.push(items.slice(i, i + size))
  }
  return result
}

// The fit table compares two lists row by row; either may be longer.
export function pairRows<A, B>(a: A[], b: B[]): [A | null, B | null][] {
  return Array.from({ length: Math.max(a.length, b.length) }, (_, i) => [
    a[i] ?? null,
    b[i] ?? null,
  ])
}
