"use client"

import { useEffect, useState } from "react"

import { ICON_NAMES, type IconName } from "@/lib/icons"

import { ServiceCardTile } from "./service-card-tile"

export type CardPreviewValues = {
  title: string
  body: string
  icon: string
  moreLabel: string
}

export const CARD_PREVIEW_MESSAGE = "service-card-preview"

const isIcon = (value: string): value is IconName =>
  (ICON_NAMES as readonly string[]).includes(value)

// Shows one service card from what the admin's form posts (same origin
// only); tells the parent when it is ready for the first values.
export function ServiceCardPreview() {
  const [values, setValues] = useState<CardPreviewValues | null>(null)
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      const data = event.data as {
        type?: string
        values?: CardPreviewValues
      } | null
      if (data?.type === CARD_PREVIEW_MESSAGE && data.values)
        setValues(data.values)
    }
    window.addEventListener("message", onMessage)
    window.parent.postMessage(
      { type: `${CARD_PREVIEW_MESSAGE}:ready` },
      window.location.origin
    )
    return () => window.removeEventListener("message", onMessage)
  }, [])
  if (!values) return null
  return (
    <div className="bg-stone p-4 sm:p-6">
      {/* The card's link would leave the preview: shown, not followable. */}
      <ul className="pointer-events-none grid max-w-md grid-cols-1">
        <ServiceCardTile
          icon={isIcon(values.icon) ? values.icon : ICON_NAMES[0]}
          title={values.title || "Service title"}
          body={values.body || "A short line about the service."}
          href="#"
          moreLabel={values.moreLabel}
        />
      </ul>
    </div>
  )
}
