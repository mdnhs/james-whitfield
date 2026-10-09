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

import { WidgetShell, type WidgetProps } from "./shell"

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
          <SelectTrigger id={id} className="w-full">
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
    onChange(ids.length ? { mode: "chosen", ids } : { mode: "all" })
  }
  return (
    <FieldSet data-invalid={error ? true : undefined}>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <RadioGroup
        value={selection.mode}
        onValueChange={(mode) =>
          onChange(
            mode === "all"
              ? { mode: "all" }
              : { mode: "chosen", ids: items.slice(0, 1).map((i) => i.id) }
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
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
