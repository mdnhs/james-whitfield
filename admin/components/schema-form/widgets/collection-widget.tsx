"use client"

import { useQuery } from "@tanstack/react-query"
import { useId } from "react"

import { collectionOptionsQuery } from "@/admin/modules/collections/queries"
import { Checkbox } from "@/components/ui/checkbox"
import { FieldError, FieldLegend, FieldSet } from "@/components/ui/field"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

import { describedBy, WidgetShell, type WidgetProps } from "./shell"

type Selection = { mode: "all" } | { mode: "chosen"; ids: string[] }

// A single row id (a band) or a Selection: "all" in collection order, or
// chosen rows in the order the editor picks them.
export function CollectionWidget({
  field,
  value,
  onChange,
  error,
}: WidgetProps<Selection | string | undefined>) {
  const id = useId()
  const options = useQuery({
    ...collectionOptionsQuery(field.collection!),
    enabled: Boolean(field.collection),
  })
  const items = options.data?.items ?? []
  if (field.node.type === "string") {
    const list = items.map((item) => ({ value: item.id, label: item.label }))
    return (
      <WidgetShell id={id} field={field} error={error}>
        <Select
          items={list}
          value={typeof value === "string" ? value : null}
          onValueChange={(next) => onChange(next as string)}
        >
          <SelectTrigger
            id={id}
            className="w-full"
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, field, error)}
          >
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {list.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </WidgetShell>
    )
  }
  const selection: Selection =
    typeof value === "object" && value ? value : { mode: "all" }
  const chosen = selection.mode === "chosen" ? selection.ids : []
  const toggle = (itemId: string, on: boolean) => {
    const ids = on ? [...chosen, itemId] : chosen.filter((x) => x !== itemId)
    // Unchecking the last row keeps "Only these" (the schema asks for at
    // least one); switching back to "All" is the editor's call.
    onChange({ mode: "chosen", ids })
  }
  return (
    <FieldSet
      data-invalid={error ? true : undefined}
      aria-describedby={describedBy(id, field, error)}
    >
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <RadioGroup
        value={selection.mode}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(id, field, error)}
        onValueChange={(mode) =>
          onChange(
            mode === "all" ? { mode: "all" } : { mode: "chosen", ids: chosen }
          )
        }
        className="flex gap-4"
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="all" /> All, in collection order
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="chosen" /> Only these
        </label>
      </RadioGroup>
      {selection.mode === "chosen" && options.isPending ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : null}
      {selection.mode === "chosen" ? (
        <ul className="flex flex-col gap-2">
          {items.map((item) => {
            const position = chosen.indexOf(item.id)
            return (
              <li key={item.id}>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={position >= 0}
                    onCheckedChange={(on) => toggle(item.id, on === true)}
                  />
                  <span className="w-5 text-muted-foreground tabular-nums">
                    {position >= 0 ? position + 1 : ""}
                  </span>
                  {item.label}
                </label>
              </li>
            )
          })}
        </ul>
      ) : null}
      {options.isError ? (
        <p className="text-sm text-destructive">Could not load the options.</p>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldSet>
  )
}
