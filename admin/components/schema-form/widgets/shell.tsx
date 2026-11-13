"use client"

import { InfoHint } from "@/admin/components/actions/icon-tip"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
} from "@/components/ui/field"
import { cn } from "@/lib/utils"

import type { FormField } from "../to-fields"

export type WidgetProps<T> = {
  field: FormField
  value: T
  onChange: (value: T) => void
  onBlur?: () => void
  error?: string
}

// aria-describedby for a control: the description and error ids WidgetShell
// renders.
export function describedBy(id: string, field: FormField, error?: string) {
  return (
    [field.description && `${id}-description`, error && `${id}-error`]
      .filter(Boolean)
      .join(" ") || undefined
  )
}

// A field's help text sits behind an info icon next to its label; the text
// keeps the id `${id}-description`, so aria-describedby still reads it.
export function FieldHint({ id, field }: { id: string; field: FormField }) {
  if (!field.description || field.warning) return null
  return <InfoHint id={`${id}-description`}>{field.description}</InfoHint>
}

// A description that warns stays on screen under the field.
export function FieldNote({ id, field }: { id: string; field: FormField }) {
  if (!field.description || !field.warning) return null
  return (
    <FieldDescription id={`${id}-description`}>
      {field.description}
    </FieldDescription>
  )
}

// A label and its info icon on one row.
export function LabelRow({
  id,
  field,
  className,
}: {
  id: string
  field: FormField
  className?: string
}) {
  return (
    <div className={cn("flex items-center gap-1.5", className)}>
      <FieldLabel
        htmlFor={id}
        className={field.hideLabel ? "sr-only" : undefined}
      >
        {field.label}
      </FieldLabel>
      <FieldHint id={id} field={field} />
    </div>
  )
}

// A fieldset's legend with the info icon. The icon would join the group's
// name, so the fieldset takes its name from the label alone
// (spread legendName(id, field) on the fieldset).
export function HintedLegend({
  id,
  field,
  variant,
}: {
  id: string
  field: FormField
  variant?: "legend" | "label"
}) {
  return (
    <FieldLegend variant={variant} className="flex items-center gap-1.5">
      <span id={`${id}-legend`}>{field.label}</span>
      <FieldHint id={id} field={field} />
    </FieldLegend>
  )
}

export const legendName = (id: string, field: FormField) =>
  field.description && !field.warning
    ? { "aria-labelledby": `${id}-legend` }
    : {}

// Label, description and error around one control (ids wire aria).
export function WidgetShell({
  id,
  field,
  error,
  children,
}: {
  id: string
  field: FormField
  error?: string
  children: React.ReactNode
}) {
  return (
    <Field data-invalid={error ? true : undefined}>
      <LabelRow id={id} field={field} />
      {children}
      <FieldNote id={id} field={field} />
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
