import "server-only"

// Fixed window per key, in memory: right for the single replica (docs/brief.md
// §5.6 rule 8). Public endpoints get the database-backed limiter in Phase 6.
const windows = new Map<string, { count: number; resetAt: number }>()

export function takeToken(
  key: string,
  { limit, windowMs }: { limit: number; windowMs: number },
  now = Date.now()
) {
  const current = windows.get(key)
  if (!current || current.resetAt <= now) {
    if (windows.size > 5000)
      for (const [k, w] of windows) if (w.resetAt <= now) windows.delete(k)
    windows.set(key, { count: 1, resetAt: now + windowMs })
    return true
  }
  if (current.count >= limit) return false
  current.count++
  return true
}
