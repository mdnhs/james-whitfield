"use client"

import { useState } from "react"

import { Input } from "@/components/ui/input"

// A number input that may be empty while typing: the draft text is local, the
// parsed number is committed as soon as it parses, and blur settles on the
// committed value (or `fallback` when left empty).
export function DraftNumber({
  id,
  value,
  fallback,
  min,
  max,
  step,
  clamp,
  onCommit,
  onBlur,
  invalid,
  describedBy,
}: {
  id: string
  value: number
  fallback: number
  min?: number
  max?: number
  step?: number | "any"
  clamp?: (n: number) => number
  onCommit: (n: number) => void
  onBlur?: () => void
  invalid?: boolean
  describedBy?: string
}) {
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <Input
      id={id}
      type="number"
      inputMode="decimal"
      min={min}
      max={max}
      step={step}
      value={draft ?? String(value)}
      onChange={(event) => {
        setDraft(event.target.value)
        const n = event.target.valueAsNumber
        if (!Number.isNaN(n)) onCommit(clamp ? clamp(n) : n)
      }}
      onBlur={() => {
        if (draft !== null && draft === "") onCommit(fallback)
        setDraft(null)
        onBlur?.()
      }}
      aria-invalid={invalid ? true : undefined}
      aria-describedby={describedBy}
    />
  )
}
