"use client"

import { useQuery } from "@tanstack/react-query"
import { useId, useState } from "react"

import { Button } from "@/components/ui/button"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"
import { globalQuery } from "@/admin/modules/globals/queries"
import {
  ConsentBannerView,
  type ConsentCopy,
} from "@/components/consent/consent-banner-view"
import type { GlobalValue } from "@/lib/content/globals"
import { BANNER_PREVIEW_STYLE } from "@/lib/tracking/banner-preview"
import type { ConsentChoice } from "@/lib/tracking/consent"

const NOOP = () => {}

// Left: the generic editor (Ruling R4). Right: the banner as visitors see it,
// fed by the unsaved draft.
export function ConsentView() {
  const saved = useQuery(globalQuery("consent"))
  const [draft, setDraft] = useState<Partial<GlobalValue<"consent">> | null>(
    null
  )
  const [mode, setMode] = useState<"first" | "custom">("first")
  const [choice, setChoice] = useState<ConsentChoice>({
    analytics: false,
    marketing: false,
  })
  const headingId = useId()
  const base = saved.data?.value as GlobalValue<"consent"> | undefined
  const copy = { ...base, ...draft } as ConsentCopy | undefined

  return (
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <GlobalEditor
        title="Consent banner"
        keys={["consent"]}
        onValuesChange={(values) =>
          setDraft(values as Partial<GlobalValue<"consent">>)
        }
      />
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-3 lg:sticky lg:top-6"
      >
        <h2 id={headingId} className="text-lg font-semibold">
          Preview
        </h2>
        <div className="flex gap-2">
          {(
            [
              ["first", "First layer"],
              ["custom", "Customise"],
            ] as const
          ).map(([value, label]) => (
            <Button
              key={value}
              type="button"
              variant={mode === value ? "default" : "outline"}
              aria-pressed={mode === value}
              onClick={() => setMode(value)}
            >
              {label}
            </Button>
          ))}
        </div>
        <div
          style={BANNER_PREVIEW_STYLE}
          className="relative h-105 overflow-hidden rounded-xl border bg-muted"
        >
          {copy ? (
            <ConsentBannerView
              inline
              copy={copy}
              mode={mode}
              choice={choice}
              onAccept={NOOP}
              onReject={NOOP}
              onCustomise={() => setMode("custom")}
              onSave={NOOP}
              onToggle={(category, on) =>
                setChoice((c) => ({ ...c, [category]: on }))
              }
            />
          ) : null}
        </div>
        <p className="text-sm text-muted-foreground">
          A preview only: nothing here is saved or stored as a visitor choice.
        </p>
      </section>
    </div>
  )
}
