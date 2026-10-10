// Called once per server instance, before it takes requests.
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return
  // `next build` has no server to tick (docs/brief.md §5.6).
  if (process.env.NEXT_PHASE === "phase-production-build") return
  const { startScheduler } = await import("./instrumentation.node")
  startScheduler()
}
