export type RouteTable = {
  live: string[]
  redirects: Record<string, { destination: string; statusCode: number }>
}
export type Resolution =
  | { kind: "live" }
  | { kind: "pass" }
  | { kind: "missing" }
  | { kind: "redirect"; destination: string; statusCode: number }

// Shapes the CMS owns: one segment (system and custom pages), service
// landing pages and articles.
// Deeper unknown paths already 404 through app/global-not-found.tsx.
const CMS_SHAPE = /^\/(?:[^/]+|(?:insights|services)\/[^/]+)$/

// Ruling R3: live content > redirect > missing > pass. "/" is never missing.
export function resolvePath(table: RouteTable, path: string): Resolution {
  if (table.live.includes(path)) return { kind: "live" }
  const hit = table.redirects[path]
  if (hit) return { kind: "redirect", ...hit }
  if (path !== "/" && CMS_SHAPE.test(path)) return { kind: "missing" }
  return { kind: "pass" }
}
