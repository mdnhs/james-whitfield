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

import type { WidgetProps } from "./shell"

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
  const number = (raw: number, fallback: number) =>
    Number.isNaN(raw) ? fallback : raw
  const countInput = (
    key: "value" | "decimals" | "prefix" | "suffix",
    label: string,
    count: Count
  ) => {
    const numeric = key === "value" || key === "decimals"
    return (
      <Field>
        <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
        <Input
          id={`${id}-${key}`}
          type={numeric ? "number" : "text"}
          inputMode={numeric ? "decimal" : undefined}
          min={numeric ? 0 : undefined}
          max={key === "decimals" ? 2 : undefined}
          step={key === "value" ? "any" : undefined}
          value={count[key]}
          onBlur={onBlur}
          onChange={(event) => {
            const raw = event.target.value
            if (key === "value")
              onChange({
                ...count,
                value: number(event.target.valueAsNumber, 0),
              })
            else if (key === "decimals") {
              onChange({
                ...count,
                decimals: Math.min(
                  2,
                  Math.max(0, Math.trunc(number(event.target.valueAsNumber, 0)))
                ),
              })
            } else onChange({ ...count, [key]: raw })
          }}
          aria-invalid={error ? true : undefined}
        />
      </Field>
    )
  }
  return (
    <FieldSet data-invalid={error ? true : undefined}>
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
          />
        </Field>
      )}
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
