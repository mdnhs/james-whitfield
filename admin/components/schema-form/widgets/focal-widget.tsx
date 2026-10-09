"use client"

import { useId } from "react"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { WidgetProps } from "./shell"

type Focal = { x: number; y: number }

// The click picker lives in the media library (Task 9); this is the
// keyboard-friendly numeric form.
export function FocalWidget({
  field,
  value,
  onChange,
  onBlur,
  error,
}: WidgetProps<Focal | null | undefined>) {
  const id = useId()
  const focal = value ?? { x: 0.5, y: 0.5 }
  const axis = (key: keyof Focal, label: string) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      <Input
        id={`${id}-${key}`}
        type="number"
        inputMode="decimal"
        min={0}
        max={1}
        step={0.05}
        value={focal[key]}
        onBlur={onBlur}
        onChange={(event) => {
          const n = event.target.valueAsNumber
          onChange({ ...focal, [key]: Number.isNaN(n) ? 0.5 : n })
        }}
        aria-invalid={error ? true : undefined}
      />
    </Field>
  )
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        {axis("x", "Across (0–1)")}
        {axis("y", "Down (0–1)")}
      </div>
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
