"use client"

import { useQuery } from "@tanstack/react-query"
import { EyeIcon, PanelBottomIcon, SlidersHorizontalIcon } from "lucide-react"
import { useId, useState } from "react"

import { InfoHint } from "@/admin/components/actions/icon-tip"
import { subnavIcon } from "@/admin/components/shell/nav-icons"

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
        icon={subnavIcon("marketing-consent")}
        description="The cookie choice visitors see first."
        keys={["consent"]}
        onValuesChange={(values) =>
          setDraft(values as Partial<GlobalValue<"consent">>)
        }
      />
      <section
        aria-labelledby={headingId}
        className="flex flex-col gap-3 lg:sticky lg:top-6"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-1">
            <h2
              id={headingId}
              className="text-card-title flex items-center gap-2"
            >
              <EyeIcon aria-hidden className="size-4 text-muted-foreground" />
              Preview
            </h2>
            <InfoHint id={`${headingId}-hint`}>
              A preview only: nothing here is saved or stored as a visitor
              choice.
            </InfoHint>
          </div>
          {/* A segmented control: which layer of the banner to show. */}
          <div
            role="group"
            aria-label="Banner layer"
            className="inline-flex rounded-xl bg-muted p-1"
          >
            {(
              [
                ["first", "First layer", PanelBottomIcon],
                ["custom", "Customise", SlidersHorizontalIcon],
              ] as const
            ).map(([value, label, Icon]) => (
              <Button
                key={value}
                type="button"
                size="sm"
                variant={mode === value ? "default" : "ghost"}
                aria-pressed={mode === value}
                className="rounded-lg"
                onClick={() => setMode(value)}
              >
                <Icon aria-hidden data-icon="inline-start" />
                {label}
              </Button>
            ))}
          </div>
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
      </section>
    </div>
  )
}
