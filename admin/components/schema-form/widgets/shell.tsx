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
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </Field>
  )
}
