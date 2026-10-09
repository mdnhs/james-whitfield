"use client"

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { useId } from "react"
import {
  Controller,
  type Control,
  type ControllerRenderProps,
  type FieldValues,
} from "react-hook-form"

import { Button } from "@/components/ui/button"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"

import type { FormField } from "./to-fields"

type Controlled = ControllerRenderProps<FieldValues, string>
// The ref travels separately: React's lint treats any object carrying `ref`
// as a ref, and reading `value` from it during render as a ref read.
type RenderInput = Omit<Controlled, "ref">

export function FieldWidget({
  field,
  control,
}: {
  field: FormField
  control: Control<FieldValues>
}) {
  if (field.widget === "group") {
    return (
      <FieldSet>
        <FieldLegend>{field.label}</FieldLegend>
        {field.description ? (
          <FieldDescription>{field.description}</FieldDescription>
        ) : null}
        <FieldGroup>
          {(field.fields ?? []).map((child) => (
            <FieldWidget key={child.name} field={child} control={control} />
          ))}
        </FieldGroup>
      </FieldSet>
    )
  }
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: { ref, ...input }, fieldState }) =>
        field.widget === "list" ? (
          <ListWidget
            field={field}
            input={input}
            error={fieldState.error?.message}
          />
        ) : (
          <ScalarWidget
            field={field}
            input={input}
            inputRef={ref}
            error={fieldState.error?.message}
          />
        )
      }
    />
  )
}

function ScalarWidget({
  field,
  input,
  inputRef,
  error,
}: {
  field: FormField
  input: RenderInput
  inputRef: Controlled["ref"]
  error?: string
}) {
  const id = useId()
  const invalid = Boolean(error)
  const counted =
    field.maxLength !== undefined &&
    (field.widget === "textarea" ||
      (field.widget === "text" && field.inputType !== "password"))
  const describedBy =
    [
      field.description && `${id}-description`,
      counted && `${id}-count`,
      error && `${id}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  const aria = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  }
  const description = field.description ? (
    <FieldDescription id={`${id}-description`}>
      {field.description}
    </FieldDescription>
  ) : null
  const errorText = error ? (
    <FieldError id={`${id}-error`}>{error}</FieldError>
  ) : null
  const options = field.options ?? []

  if (field.widget === "toggle") {
    return (
      <Field orientation="horizontal" data-invalid={invalid || undefined}>
        <Switch
          id={id}
          checked={Boolean(input.value)}
          onCheckedChange={(checked) => input.onChange(checked)}
          {...aria}
        />
        <FieldContent>
          <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
          {description}
          {errorText}
        </FieldContent>
      </Field>
    )
  }

  if (field.widget === "radio") {
    return (
      <FieldSet data-invalid={invalid || undefined}>
        <FieldLegend variant="label">{field.label}</FieldLegend>
        {description}
        <RadioGroup
          value={input.value ?? ""}
          onValueChange={(value) => input.onChange(value)}
          {...aria}
        >
          {options.map((option) => (
            <Field key={option.value} orientation="horizontal">
              <RadioGroupItem
                value={option.value}
                id={`${id}-${option.value}`}
              />
              <FieldLabel
                htmlFor={`${id}-${option.value}`}
                className="font-normal"
              >
                {option.label}
              </FieldLabel>
            </Field>
          ))}
        </RadioGroup>
        {errorText}
      </FieldSet>
    )
  }

  let control: React.ReactNode
  if (field.widget === "textarea") {
    control = (
      <Textarea
        id={id}
        name={input.name}
        ref={inputRef}
        rows={4}
        placeholder={field.placeholder}
        value={input.value ?? ""}
        onBlur={input.onBlur}
        onChange={(event) => input.onChange(event.target.value)}
        {...aria}
      />
    )
  } else if (field.widget === "number") {
    control = (
      <Input
        id={id}
        name={input.name}
        ref={inputRef}
        type="number"
        inputMode="numeric"
        placeholder={field.placeholder}
        value={input.value ?? ""}
        onBlur={input.onBlur}
        onChange={(event) =>
          input.onChange(
            event.target.value === "" ? undefined : event.target.valueAsNumber
          )
        }
        {...aria}
      />
    )
  } else if (field.widget === "select") {
    control = (
      <Select
        items={options}
        value={input.value ?? null}
        onValueChange={(value) => input.onChange(value)}
      >
        <SelectTrigger
          id={id}
          className="w-full"
          onBlur={input.onBlur}
          {...aria}
        >
          <SelectValue placeholder="Choose…" />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    )
  } else {
    control = (
      <Input
        id={id}
        name={input.name}
        ref={inputRef}
        type={field.inputType ?? "text"}
        autoComplete={field.autoComplete}
        placeholder={field.placeholder}
        value={input.value ?? ""}
        onBlur={input.onBlur}
        onChange={(event) => input.onChange(event.target.value)}
        {...aria}
      />
    )
  }

  return (
    <Field data-invalid={invalid || undefined}>
      <div className="flex items-baseline justify-between gap-3">
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
        {counted ? (
          <span
            id={`${id}-count`}
            className="text-xs text-muted-foreground tabular-nums"
          >
            {String(input.value ?? "").length}/{field.maxLength}
          </span>
        ) : null}
      </div>
      {control}
      {description}
      {errorText}
    </Field>
  )
}

// Phase 2 lists hold text items and reorder with buttons (fully keyboard
// operable). Drag handles (dnd-kit) arrive with the page builder in Phase 4.
function ListWidget({
  field,
  input,
  error,
}: {
  field: FormField
  input: RenderInput
  error?: string
}) {
  const items: string[] = Array.isArray(input.value) ? input.value : []
  const min = field.minItems ?? 0
  const max = field.maxItems ?? Number.POSITIVE_INFINITY
  const set = (next: string[]) => input.onChange(next)
  const move = (from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved!)
    set(next)
  }
  return (
    <FieldSet data-invalid={Boolean(error) || undefined}>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <ol className="flex flex-col gap-2">
        {items.map((value, index) => (
          <li key={index} className="flex items-center gap-2">
            <Input
              aria-label={`${field.label} ${index + 1}`}
              value={value}
              onBlur={input.onBlur}
              onChange={(event) =>
                set(
                  items.map((item, i) =>
                    i === index ? event.target.value : item
                  )
                )
              }
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${field.label} ${index + 1} up`}
              disabled={index === 0}
              onClick={() => move(index, index - 1)}
            >
              <ChevronUpIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="outline"
              size="icon"
              aria-label={`Move ${field.label} ${index + 1} down`}
              disabled={index === items.length - 1}
              onClick={() => move(index, index + 1)}
            >
              <ChevronDownIcon aria-hidden />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={`Remove ${field.label} ${index + 1}`}
              disabled={items.length <= min}
              onClick={() => set(items.filter((_, i) => i !== index))}
            >
              <TrashIcon aria-hidden />
            </Button>
          </li>
        ))}
      </ol>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= max}
          onClick={() => set([...items, ""])}
        >
          <PlusIcon data-icon="inline-start" />
          Add to {field.label.toLowerCase()}
        </Button>
      </div>
      {Number.isFinite(max) ? (
        <FieldDescription>
          {min > 0 ? `Between ${min} and ${max} items.` : `Up to ${max} items.`}
        </FieldDescription>
      ) : null}
      {error ? <FieldError>{error}</FieldError> : null}
    </FieldSet>
  )
}
