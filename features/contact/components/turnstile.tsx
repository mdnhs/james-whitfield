"use client"

import { useEffect, useRef } from "react"

type TurnstileApi = {
  render(el: HTMLElement, options: Record<string, unknown>): string
  remove(id: string): void
}
type TurnstileWindow = Window & { turnstile?: TurnstileApi }

const SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit"
let loading: Promise<void> | null = null

function loadScript(): Promise<void> {
  loading ??= new Promise<void>((resolve, reject) => {
    const script = document.createElement("script")
    script.src = SRC
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => {
      loading = null
      reject(new Error("Turnstile failed to load"))
    }
    document.head.appendChild(script)
  })
  return loading
}

export function Turnstile({
  siteKey,
  onToken,
}: {
  siteKey: string
  onToken(token: string | null): void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const callback = useRef(onToken)
  useEffect(() => {
    callback.current = onToken
  })

  useEffect(() => {
    let id: string | undefined
    let cancelled = false
    loadScript()
      .then(() => {
        const api = (window as TurnstileWindow).turnstile
        if (cancelled || !ref.current || !api) return
        id = api.render(ref.current, {
          sitekey: siteKey,
          action: "lead",
          callback: (token: string) => callback.current(token),
          "expired-callback": () => callback.current(null),
          "error-callback": () => callback.current(null),
        })
      })
      .catch(() => callback.current(null))
    return () => {
      cancelled = true
      if (id) (window as TurnstileWindow).turnstile?.remove(id)
    }
  }, [siteKey])

  return <div ref={ref} className="min-h-16.25" />
}
