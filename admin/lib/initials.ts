// Up to two initials for avatar fallbacks; "?" when there is no name.
export function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean).slice(0, 2)
  return parts.length
    ? parts.map((part) => part[0]!.toUpperCase()).join("")
    : "?"
}
