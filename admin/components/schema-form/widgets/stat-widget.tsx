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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import type { StatValue } from "@/lib/count"

import { DraftNumber } from "./draft-number"
import { describedBy, type WidgetProps } from "./shell"

type Count = Extract<StatValue, { kind: "count" }>

const COUNT: Count = {
  kind: "count",
  value: 0,
  decimals: 0,
  prefix: "",
  suffix: "",
}
const TEXT: StatValue = { kind: "text", text: "" }

export function StatWidget({
  field,
  value,
  onChange,
  onBlur,
  error,
}: WidgetProps<StatValue | undefined>) {
  const id = useId()
  const stat = value ?? COUNT
  const described = describedBy(id, field, error)
  const countInput = (
    key: "value" | "decimals" | "prefix" | "suffix",
    label: string,
    count: Count
  ) => {
    const numeric = key === "value" || key === "decimals"
    return (
      <Field>
        <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
        {numeric ? (
          <DraftNumber
            id={`${id}-${key}`}
            min={0}
            max={key === "decimals" ? 2 : undefined}
            step={key === "value" ? "any" : 1}
            value={count[key as "value" | "decimals"]}
            fallback={0}
            clamp={
              key === "decimals"
                ? (n) => Math.min(2, Math.max(0, Math.trunc(n)))
                : undefined
            }
            onCommit={(n) => onChange({ ...count, [key]: n })}
            onBlur={onBlur}
            invalid={Boolean(error)}
            describedBy={described}
          />
        ) : (
          <Input
            id={`${id}-${key}`}
            value={count[key as "prefix" | "suffix"]}
            onBlur={onBlur}
            onChange={(event) =>
              onChange({ ...count, [key]: event.target.value })
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
          />
        )}
      </Field>
    )
  }
  return (
    <FieldSet
      data-invalid={error ? true : undefined}
      aria-describedby={described}
    >
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <RadioGroup
        value={stat.kind}
        className="flex gap-4"
        onValueChange={(kind) => onChange(kind === "count" ? COUNT : TEXT)}
      >
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="count" /> Number (counts up)
        </label>
        <label className="flex items-center gap-2 text-sm">
          <RadioGroupItem value="text" /> Text
        </label>
      </RadioGroup>
      {stat.kind === "count" ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {countInput("value", "Value", stat)}
          {countInput("decimals", "Decimals", stat)}
          {countInput("prefix", "Prefix", stat)}
          {countInput("suffix", "Suffix", stat)}
        </div>
      ) : (
        <Field>
          <FieldLabel htmlFor={`${id}-text`}>Text</FieldLabel>
          <Input
            id={`${id}-text`}
            value={stat.text}
            onBlur={onBlur}
            onChange={(event) =>
              onChange({ kind: "text", text: event.target.value })
            }
            aria-invalid={error ? true : undefined}
            aria-describedby={described}
          />
        </Field>
      )}
      {field.description ? (
        <FieldDescription id={`${id}-description`}>
          {field.description}
        </FieldDescription>
      ) : null}
      {error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
    </FieldSet>
  )
}
