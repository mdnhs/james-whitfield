// "/" and "/about" are exact; "/insights/*" is a prefix (not "/insights").
export function matchesRoute(patterns: readonly string[], pathname: string) {
  if (patterns.length === 0) return true
  return patterns.some((p) =>
    p.endsWith("*") ? pathname.startsWith(p.slice(0, -1)) : pathname === p
  )
}
