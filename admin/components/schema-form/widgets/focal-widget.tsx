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

import { DraftNumber } from "./draft-number"
import { describedBy, type WidgetProps } from "./shell"

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
  const described = describedBy(id, field, error)
  const focal = value ?? { x: 0.5, y: 0.5 }
  const axis = (key: keyof Focal, label: string) => (
    <Field>
      <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
      <DraftNumber
        id={`${id}-${key}`}
        min={0}
        max={1}
        step={0.05}
        value={focal[key]}
        fallback={0.5}
        onCommit={(n) => onChange({ ...focal, [key]: n })}
        onBlur={onBlur}
        invalid={Boolean(error)}
        describedBy={described}
      />
    </Field>
  )
  return (
    <FieldSet
      data-invalid={error ? true : undefined}
      aria-describedby={described}
    >
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        {axis("x", "Across (0–1)")}
        {axis("y", "Down (0–1)")}
      </div>
      {field.description ? (
        <FieldDescription id={`${id}-description`}>
          {field.description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldSet>
  )
}
