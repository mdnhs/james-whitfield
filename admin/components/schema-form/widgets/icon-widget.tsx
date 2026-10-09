"use client"

import { useId } from "react"

import { CONTENT_ICONS } from "@/components/icons/content-icons"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { IconName } from "@/lib/icons"

import { WidgetShell, type WidgetProps } from "./shell"

// Content icons come from the code registry; docs/brief.md §14 forbids
// uploaded SVG.
export function IconWidget({
  field,
  value,
  onChange,
  onBlur,
  error,
}: WidgetProps<IconName | undefined>) {
  const id = useId()
  const options = field.options ?? []
  return (
    <WidgetShell id={id} field={field} error={error}>
      <Select
        items={options}
        value={value ?? null}
        onValueChange={(next) => onChange(next as IconName)}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          onBlur={onBlur}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
        >
          <SelectValue placeholder="Choose an icon" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => {
            const { Svg } = CONTENT_ICONS[option.value as IconName]
            return (
              <SelectItem key={option.value} value={option.value}>
                <Svg aria-hidden className="size-4" />
                {option.label}
              </SelectItem>
            )
          })}
        </SelectContent>
      </Select>
    </WidgetShell>
  )
}
