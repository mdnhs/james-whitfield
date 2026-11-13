// Cache Components keeps visited routes in the DOM, hidden by React
// <Activity> (display: none). Lookups for page content must resolve inside the
// page the reader can see, never across the whole document.
const PAGE_ROOT = "[data-page-root]"

const isRendered = (element: Element) => element.getClientRects().length > 0

// Ids are validated kebab-case (blocks schema); quotes are escaped anyway.
const byId = (id: string) => `[id="${id.replace(/"/g, '\\"')}"]`

export function activePageRoot(): HTMLElement | null {
  for (const root of document.querySelectorAll<HTMLElement>(PAGE_ROOT)) {
    if (isRendered(root)) return root
  }
  return null
}

// A section id for rails and hash links: first inside the page that owns
// `from` (or the visible page), then in shared chrome such as the footer.
export function findTarget(
  id: string,
  from?: Element | null
): HTMLElement | null {
  const root = from?.closest<HTMLElement>(PAGE_ROOT) ?? activePageRoot()
  const inPage = root?.querySelector<HTMLElement>(byId(id))
  if (inPage) return inPage
  // A hidden page may hold the same id earlier in the DOM, so take the first
  // rendered match rather than the first match.
  for (const el of document.querySelectorAll<HTMLElement>(byId(id))) {
    if (isRendered(el)) return el
  }
  return null
}

// Where `el` lies in the document flow, in page pixels. Stacked cards are
// position: sticky, so while one is stuck its rect reports where it is pinned,
// not where it sits in the flow: scrolling "to" it would barely move, then
// jolt. A card's flow top is its parent's top plus the cards before it (they
// sit end to end, as page-motion assumes); an element inside adds its offset
// within the card, which sticking does not change.
export function flowTop(el: HTMLElement): number {
  const card = el.closest<HTMLElement>("[data-stack]")
  const parent = card?.parentElement
  if (!card || !parent) return el.getBoundingClientRect().top + scrollY

  let y = parent.getBoundingClientRect().top + scrollY
  for (const sibling of parent.querySelectorAll<HTMLElement>(
    ":scope > [data-stack]"
  )) {
    if (sibling === card) break
    y += sibling.offsetHeight
  }

  let node: HTMLElement | null = el
  while (node && node !== card) {
    y += node.offsetTop
    node = node.offsetParent as HTMLElement | null
  }
  return y
}
