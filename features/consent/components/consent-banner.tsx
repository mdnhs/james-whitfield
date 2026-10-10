"use client"

import { useEffect, useRef, useState } from "react"

import {
  ConsentBannerView,
  type ConsentCopy,
} from "@/components/consent/consent-banner-view"
import {
  CONSENT_COOKIE,
  cookieValue,
  readConsent,
  type ConsentChoice,
  type ConsentPolicy,
} from "@/lib/tracking/consent"
import {
  getConsentSnapshot,
  OPEN_CONSENT_EVENT,
  saveConsent,
} from "@/lib/tracking/consent-client"

const NONE: ConsentChoice = { analytics: false, marketing: false }

export function ConsentBanner({
  copy,
  policy,
}: {
  copy: ConsentCopy
  policy: ConsentPolicy
}) {
  const [open, setOpen] = useState(false)
  const [mode, setMode] = useState<"first" | "custom">("first")
  const [choice, setChoice] = useState<ConsentChoice>(NONE)
  const heading = useRef<HTMLHeadingElement>(null)
  const focusHeading = useRef(false)

  // The cookie is browser-only: reading it after mount keeps the server HTML
  // and the first client render identical (no hydration mismatch).
  useEffect(() => {
    const stored = readConsent(
      cookieValue(document.cookie, CONSENT_COOKIE),
      policy,
      Date.now()
    )
    // eslint-disable-next-line react-hooks/set-state-in-effect -- mount-only external read
    if (stored === null) setOpen(true)
  }, [policy])

  useEffect(() => {
    const onOpen = () => {
      setChoice(getConsentSnapshot() ?? NONE)
      setMode("custom")
      focusHeading.current = true
      setOpen(true)
    }
    window.addEventListener(OPEN_CONSENT_EVENT, onOpen)
    return () => window.removeEventListener(OPEN_CONSENT_EVENT, onOpen)
  }, [])

  useEffect(() => {
    if (open && focusHeading.current) {
      focusHeading.current = false
      heading.current?.focus()
    }
  }, [open])

  if (!open) return null

  const commit = (c: ConsentChoice, kind: "accept" | "reject" | "custom") => {
    saveConsent(c, kind, policy)
    setOpen(false)
  }

  return (
    <ConsentBannerView
      copy={copy}
      mode={mode}
      choice={choice}
      headingRef={heading}
      onAccept={() => commit({ analytics: true, marketing: true }, "accept")}
      onReject={() => commit(NONE, "reject")}
      onCustomise={() => setMode("custom")}
      onSave={() => commit(choice, "custom")}
      onToggle={(category, on) =>
        setChoice((prev) => ({ ...prev, [category]: on }))
      }
    />
  )
}
