import { PIXEL_ID, validId } from "./ids"

type PixelFn = ((...args: unknown[]) => void) & {
  callMethod?: (...args: unknown[]) => void
  queue: unknown[][]
  push: PixelFn
  loaded: boolean
  version: string
  disablePushState: boolean
  allowDuplicatePageViews: boolean
}
type Env = {
  window: Record<string, unknown>
  document: {
    createElement: (tag: "script") => { async?: boolean; src?: string }
    head: { appendChild: (el: { async?: boolean; src?: string }) => unknown }
  }
}

// Meta's base code, without its automatic PageView (brief §12.4): autoConfig
// off before init, no history-based PageViews. track() sends events.
export function loadPixel(
  id: string,
  env: Env = { window: window as never, document: document as never }
): boolean {
  const w = env.window
  if (!validId(PIXEL_ID, id) || w.fbq) return false
  const fbq = function (...args: unknown[]) {
    if (fbq.callMethod) fbq.callMethod(...args)
    else fbq.queue.push(args)
  } as PixelFn
  fbq.queue = []
  fbq.push = fbq
  fbq.loaded = true
  fbq.version = "2.0"
  fbq.disablePushState = true
  fbq.allowDuplicatePageViews = true
  w.fbq = fbq
  w._fbq ??= fbq
  fbq("set", "autoConfig", false, id)
  fbq("init", id)
  const script = env.document.createElement("script")
  script.async = true
  script.src = "https://connect.facebook.net/en_US/fbevents.js"
  env.document.head.appendChild(script)
  return true
}
