"use client"

import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"

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
      <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      {children}
      {field.description ? (
        <FieldDescription id={`${id}-description`}>
          {field.description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
