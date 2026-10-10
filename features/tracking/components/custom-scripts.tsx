"use client"

import { usePathname } from "next/navigation"
import Script from "next/script"
import { useSyncExternalStore } from "react"

import type { ScriptSnippet } from "@/lib/content/globals"
import {
  getConsentSnapshot,
  getServerConsentSnapshot,
  subscribeConsent,
} from "@/lib/tracking/consent-client"
import { matchesRoute } from "@/lib/tracking/routes-match"

// docs/brief.md §12.6: next/script (raw inline scripts do not run on client
// renders). Ruling R15: head → afterInteractive, body → lazyOnload. A snippet
// runs once per document; leaving a matching route does not undo it.
export function CustomScripts({ snippets }: { snippets: ScriptSnippet[] }) {
  const pathname = usePathname()
  const consent = useSyncExternalStore(
    subscribeConsent,
    getConsentSnapshot,
    getServerConsentSnapshot
  )
  const allowed = (s: ScriptSnippet) =>
    s.category === "necessary" ||
    (s.category === "analytics" ? consent?.analytics : consent?.marketing)
  return snippets.map((s, i) => {
    if (!allowed(s) || !matchesRoute(s.routes, pathname)) return null
    const id = `mk-code-${i}`
    const strategy = s.placement === "head" ? "afterInteractive" : "lazyOnload"
    return s.src ? (
      <Script key={id} id={id} src={s.src} strategy={strategy} />
    ) : (
      <Script key={id} id={id} strategy={strategy}>
        {s.inline}
      </Script>
    )
  })
}
