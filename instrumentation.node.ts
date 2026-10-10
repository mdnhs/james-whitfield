import { internalOrigin } from "./lib/internal-origin"

const INTERVAL_MS = 60_000
const g = globalThis as { __mkScheduler?: ReturnType<typeof setInterval> }

// docs/brief.md §5.5(f): HTTP, so revalidateTag runs in a request context.
// No server modules here: instrumentation is bundled outside the RSC graph.
export function startScheduler() {
  const secret = process.env.CRON_SECRET
  if (process.env.SCHEDULER === "off") return
  if (!secret) {
    console.warn(
      "[scheduler] CRON_SECRET is not set; scheduled publishing is off"
    )
    return
  }
  if (g.__mkScheduler) return // dev re-registers on reload
  const url = `${internalOrigin()}/api/v1/cron/tick`
  g.__mkScheduler = setInterval(() => {
    fetch(url, {
      method: "POST",
      headers: { authorization: `Bearer ${secret}` },
      signal: AbortSignal.timeout(30_000),
    })
      .then((res) => {
        if (!res.ok) console.error(`[scheduler] tick answered ${res.status}`)
      })
      .catch((error: unknown) =>
        console.error("[scheduler] tick failed", error)
      )
  }, INTERVAL_MS)
  g.__mkScheduler.unref?.()
}
