// The one search-text normaliser: the ⌘K search service and the palette's
// client-side actions both match through it, so a query means the same thing
// on either side. Isomorphic: no server-only imports.
export const normaliseSearch = (text: string) =>
  text
    .normalize("NFKD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("en-IE")
    .trim()

export const matchesSearch = (q: string, texts: readonly string[]): boolean => {
  const needle = normaliseSearch(q)
  return !needle || texts.some((text) => normaliseSearch(text).includes(needle))
}
