import "server-only"

import { isIP } from "node:net"

// Traefik overwrites X-Real-IP in production (Phase 1 carry); Better Auth
// keys its limiter on the same header. Chains are never trusted.
export function clientIp(headers: Headers): string | null {
  const value = headers.get("x-real-ip")?.trim() ?? ""
  return isIP(value) ? value : null
}
