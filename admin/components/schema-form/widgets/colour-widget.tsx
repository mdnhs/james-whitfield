"use client"

import { useId } from "react"

import { Input } from "@/components/ui/input"

import { describedBy, WidgetShell, type WidgetProps } from "./shell"

const HEX = /^#[0-9a-f]{6}$/i

export function ColourWidget({
  field,
  value,
  onChange,
  onBlur,
  error,
}: WidgetProps<string | undefined>) {
  const id = useId()
  const text = value ?? ""
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div className="flex items-center gap-2">
        <input
          type="color"
          aria-label={`${field.label} picker`}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, field, error)}
          className="h-9 w-12 shrink-0 cursor-pointer rounded-lg border border-input bg-transparent p-1"
          value={HEX.test(text) ? text : "#000000"}
          onChange={(event) => onChange(event.target.value)}
        />
        <Input
          id={id}
          value={text}
          placeholder="#157d38"
          onBlur={onBlur}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy(id, field, error)}
        />
      </div>
    </WidgetShell>
  )
}
