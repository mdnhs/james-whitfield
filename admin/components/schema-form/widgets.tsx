"use client"

import {
  ChevronDownIcon,
  ChevronUpIcon,
  PlusIcon,
  TrashIcon,
} from "lucide-react"
import { useId, useState } from "react"
import {
  Controller,
  get,
  useController,
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
import { cn } from "@/lib/utils"

import { emptyValue, rebase, type FormField } from "./to-fields"
import {
  FieldHint,
  FieldNote,
  HintedLegend,
  LabelRow,
  legendName,
} from "./widgets/shell"
import { CollectionWidget } from "./widgets/collection-widget"
import { ColourWidget } from "./widgets/colour-widget"
import { FocalWidget } from "./widgets/focal-widget"
import { FrameWidget } from "./widgets/frame-widget"
import { IconWidget } from "./widgets/icon-widget"
import { LinkWidget } from "./widgets/link-widget"
import { MediaWidget } from "./widgets/media-widget"
import { RichTextWidget } from "./widgets/rich-text-widget"
import { StatWidget } from "./widgets/stat-widget"

type Controlled = ControllerRenderProps<FieldValues, string>
// The ref travels separately: React's lint treats any object carrying `ref`
// as a ref, and reading `value` from it during render as a ref read.
type RenderInput = Omit<Controlled, "ref">

type Props = { field: FormField; control: Control<FieldValues> }

// Object-valued fields that may be null get an explicit on/off switch.
const TOGGLED: ReadonlySet<FormField["widget"]> = new Set([
  "group",
  "link",
  "stat",
  "focal",
])

export function FieldWidget({ field, control }: Props) {
  if (field.nullable && TOGGLED.has(field.widget))
    return <NullableField field={field} control={control} />
  switch (field.widget) {
    case "group":
      return <GroupWidget field={field} control={control} />
    case "list":
      return <ListWidget field={field} control={control} />
    case "link":
      return <LinkWidget field={field} control={control} />
    case "frame":
      return <FrameWidget field={field} control={control} />
    default:
      return <LeafWidget field={field} control={control} />
  }
}

function GroupWidget({ field, control }: Props) {
  const id = useId()
  return (
    <FieldSet className="min-w-0" {...legendName(id, field)}>
      <HintedLegend id={id} field={field} />
      <FieldNote id={id} field={field} />
      {compactColumns(field) ? (
        // A few short text fields (a button's label and link) side by side.
        <div className="grid gap-4 sm:grid-cols-2">
          {(field.fields ?? []).map((child) => (
            <FieldWidget key={child.name} field={child} control={control} />
          ))}
        </div>
      ) : (
        <FieldGroup>
          {(field.fields ?? []).map((child) => (
            <FieldWidget key={child.name} field={child} control={control} />
          ))}
        </FieldGroup>
      )}
    </FieldSet>
  )
}

function NullableField({ field, control }: Props) {
  const id = useId()
  const { field: input } = useController({ name: field.name, control })
  const on = input.value !== null && input.value !== undefined
  return (
    <div className="flex flex-col gap-3">
      <Field orientation="horizontal">
        <Switch
          id={id}
          checked={on}
          onCheckedChange={(checked) =>
            input.onChange(checked ? emptyValue(field.node) : null)
          }
        />
        <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
      </Field>
      {on ? (
        <FieldWidget field={{ ...field, nullable: false }} control={control} />
      ) : null}
    </div>
  )
}

// The first message under a field (objects nest their errors).
function firstMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined
  const { message } = error as { message?: unknown }
  if (typeof message === "string") return message
  for (const child of Object.values(error)) {
    const found = firstMessage(child)
    if (found) return found
  }
  return undefined
}

function LeafWidget({ field, control }: Props) {
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: { ref, ...input }, fieldState, formState }) => {
        const error =
          fieldState.error?.message ??
          firstMessage(get(formState.errors, field.name))
        const props = {
          field,
          value: input.value,
          onChange: input.onChange,
          onBlur: input.onBlur,
          error,
        }
        switch (field.widget) {
          case "media":
            return <MediaWidget {...props} />
          case "icon":
            return <IconWidget {...props} />
          case "stat":
            return <StatWidget {...props} />
          case "richtext":
            return <RichTextWidget {...props} />
          case "collection":
            return <CollectionWidget {...props} />
          case "colour":
            return <ColourWidget {...props} />
          case "focal":
            return <FocalWidget {...props} />
          default:
            return (
              <ScalarWidget
                field={field}
                input={input}
                inputRef={ref}
                error={error}
              />
            )
        }
      }}
    />
  )
}

// Text items keep the Phase 2 inline row (input + up/down/remove). Any other
// item (objects, images, textareas) renders as its own fieldset.
function ListWidget({ field, control }: Props) {
  const id = useId()
  const { field: input, fieldState } = useController({
    name: field.name,
    control,
  })
  const items: unknown[] = Array.isArray(input.value) ? input.value : []
  const item = field.item!
  const min = field.minItems ?? 0
  const max = field.maxItems ?? Number.POSITIVE_INFINITY
  const set = (next: unknown[]) => input.onChange(next)
  const move = (from: number, to: number) => {
    const next = [...items]
    const [moved] = next.splice(from, 1)
    next.splice(to, 0, moved)
    set(next)
  }
  const error =
    fieldState.error?.message ??
    (fieldState.error as { root?: { message?: string } } | undefined)?.root
      ?.message
  const controls = (index: number) => (
    <div className="flex shrink-0 gap-0.5">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${field.label} ${index + 1} up`}
        disabled={index === 0}
        onClick={() => move(index, index - 1)}
      >
        <ChevronUpIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        aria-label={`Move ${field.label} ${index + 1} down`}
        disabled={index === items.length - 1}
        onClick={() => move(index, index + 1)}
      >
        <ChevronDownIcon aria-hidden />
      </Button>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="hover:bg-danger-soft hover:text-danger text-muted-foreground"
        aria-label={`Remove ${field.label} ${index + 1}`}
        disabled={items.length <= min}
        onClick={() => set(items.filter((_, i) => i !== index))}
      >
        <TrashIcon aria-hidden />
      </Button>
    </div>
  )
  const inline = item.widget === "text"
  // A small item of a few short text fields (a link's label and address)
  // is one row: its inputs side by side, column names once above the list.
  const columns = compactColumns(item)
  return (
    <FieldSet
      data-invalid={error ? true : undefined}
      // A fieldset is min-content wide by default: a long item would widen
      // the page instead of truncating.
      className="w-full min-w-0"
      {...legendName(id, field)}
    >
      <HintedLegend id={id} field={field} variant="label" />
      <FieldNote id={id} field={field} />
      {columns && items.length > 0 ? (
        <div
          aria-hidden
          className="grid gap-2 pr-24 text-xs font-medium text-muted-foreground"
          style={{
            gridTemplateColumns: `repeat(${columns.length}, minmax(0, 1fr))`,
          }}
        >
          {columns.map((column) => (
            <span key={column.name}>{columnLabel(column)}</span>
          ))}
        </div>
      ) : null}
      <ol className={columns ? "flex flex-col gap-2" : "flex flex-col gap-3"}>
        {items.map((value, index) => {
          const child = {
            ...rebase(item, `${field.name}.$`, `${field.name}.${index}`),
            label: `${field.label} ${index + 1}`,
          }
          // One field in the item: the header names it, so its own label
          // only stays for screen readers.
          const single =
            child.widget !== "group" || (child.fields ?? []).length === 1
          const inner = (child.fields ?? []).map((f) =>
            single ? { ...f, hideLabel: true } : f
          )
          return (
            <li key={index}>
              {columns ? (
                <CompactGroupItem
                  label={child.label}
                  fields={child.fields ?? []}
                  control={control}
                  actions={controls(index)}
                />
              ) : inline ? (
                <InlineTextItem
                  field={child}
                  control={control}
                  listId={id}
                  index={index}
                  actions={controls(index)}
                />
              ) : (
                <fieldset
                  aria-label={child.label}
                  className="flex w-full min-w-0 flex-col gap-3 rounded-xl border p-3"
                >
                  <div className="flex min-w-0 items-center justify-between gap-2">
                    <span
                      data-item-title
                      className="min-w-0 flex-1 truncate text-sm font-medium"
                    >
                      {itemTitle(item, value, index)}
                    </span>
                    {controls(index)}
                  </div>
                  {child.widget === "group" ? (
                    // The item's own fieldset already names the group.
                    <FieldGroup>
                      {inner.map((innerField) => (
                        <FieldWidget
                          key={innerField.name}
                          field={innerField}
                          control={control}
                        />
                      ))}
                    </FieldGroup>
                  ) : (
                    <FieldWidget
                      field={{ ...child, hideLabel: true }}
                      control={control}
                    />
                  )}
                </fieldset>
              )}
            </li>
          )
        })}
      </ol>
      <div>
        <Button
          type="button"
          variant="outline"
          disabled={items.length >= max}
          onClick={() => set([...items, inline ? "" : emptyValue(item.node)])}
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

// A list item's header: its own first words (a link's label, a social
// profile's platform), else "Item 2".
export function itemTitle(
  item: FormField,
  value: unknown,
  index: number
): string {
  const fallback = `Item ${index + 1}`
  if (typeof value === "string") return shortTitle(value) || fallback
  if (item.widget !== "group" || !value || typeof value !== "object")
    return fallback
  const record = value as Record<string, unknown>
  for (const f of item.fields ?? []) {
    const key = f.name.split(".").at(-1) ?? ""
    const raw = record[key]
    if (typeof raw !== "string" || !raw.trim()) continue
    if (f.widget === "text" || f.widget === "textarea") return shortTitle(raw)
    if (f.widget === "select" || f.widget === "radio")
      return f.options?.find((o) => o.value === raw)?.label ?? raw
  }
  return fallback
}

// A header, not a paragraph: the first line, cut at ITEM_TITLE_MAX.
export const ITEM_TITLE_MAX = 60
function shortTitle(text: string): string {
  const line = text.trim().split(/\r?\n/)[0]!.trim()
  return line.length > ITEM_TITLE_MAX
    ? `${line.slice(0, ITEM_TITLE_MAX).trimEnd()}…`
    : line
}

// 90% of a limit: from here the counter stays on screen.
export const nearLimit = (max: number) => Math.ceil(max * 0.9)

// An item that fits on one row: a group of at most three short text fields.
function compactColumns(item: FormField): FormField[] | null {
  if (item.widget !== "group") return null
  const fields = item.fields ?? []
  if (fields.length === 0 || fields.length > 3) return null
  return fields.every((f) => f.widget === "text" && !f.description)
    ? fields
    : null
}

const columnLabel = (field: FormField) => field.label

function CompactGroupItem({
  label,
  fields,
  control,
  actions,
}: {
  label: string
  fields: FormField[]
  control: Control<FieldValues>
  actions: React.ReactNode
}) {
  return (
    <fieldset
      aria-label={label}
      className="flex w-full min-w-0 items-start gap-2"
    >
      <div
        className="grid min-w-0 flex-1 gap-2"
        style={{
          gridTemplateColumns: `repeat(${fields.length}, minmax(0, 1fr))`,
        }}
      >
        {fields.map((inner) => (
          <Controller
            key={inner.name}
            name={inner.name}
            control={control}
            render={({ field: { ref, ...input }, fieldState }) => (
              <div className="flex min-w-0 flex-col gap-1">
                <Input
                  ref={ref}
                  name={input.name}
                  aria-label={inner.label}
                  placeholder={
                    /(^|\.)href$/.test(inner.name)
                      ? "/contact, #faq or https://…"
                      : columnLabel(inner)
                  }
                  maxLength={inner.maxLength}
                  aria-invalid={fieldState.error ? true : undefined}
                  value={input.value ?? ""}
                  onBlur={input.onBlur}
                  onChange={(event) => input.onChange(event.target.value)}
                />
                {fieldState.error?.message ? (
                  <FieldError>{fieldState.error.message}</FieldError>
                ) : null}
              </div>
            )}
          />
        ))}
      </div>
      {actions}
    </fieldset>
  )
}

function InlineTextItem({
  field,
  control,
  listId,
  index,
  actions,
}: {
  field: FormField
  control: Control<FieldValues>
  listId: string
  index: number
  actions: React.ReactNode
}) {
  return (
    <Controller
      name={field.name}
      control={control}
      render={({ field: { ref, ...input }, fieldState }) => {
        const itemError = fieldState.error?.message
        return (
          <div className="flex flex-col gap-1">
            <div className="flex items-center gap-2">
              <Input
                ref={ref}
                name={input.name}
                aria-label={field.label}
                aria-invalid={itemError ? true : undefined}
                aria-describedby={
                  itemError ? `${listId}-${index}-error` : undefined
                }
                value={input.value ?? ""}
                onBlur={input.onBlur}
                onChange={(event) => input.onChange(event.target.value)}
              />
              {actions}
            </div>
            {itemError ? (
              <FieldError id={`${listId}-${index}-error`}>
                {itemError}
              </FieldError>
            ) : null}
          </div>
        )
      }}
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
  const [focused, setFocused] = useState(false)
  const invalid = Boolean(error)
  const counted =
    field.maxLength !== undefined &&
    (field.widget === "textarea" ||
      (field.widget === "text" && field.inputType !== "password"))
  const length = String(input.value ?? "").length
  // The counter shows while typing here, or once the text is near its limit.
  const showCount =
    counted && (focused || length >= nearLimit(field.maxLength!))
  const describedBy =
    [
      field.description && `${id}-description`,
      showCount && `${id}-count`,
      error && `${id}-error`,
    ]
      .filter(Boolean)
      .join(" ") || undefined
  const aria = {
    "aria-invalid": invalid || undefined,
    "aria-describedby": describedBy,
    "aria-required": field.required || undefined,
  }
  const description = <FieldNote id={id} field={field} />
  const hint = <FieldHint id={id} field={field} />
  const track = {
    onFocus: () => setFocused(true),
    onBlur: () => {
      setFocused(false)
      input.onBlur()
    },
  }
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
          <div className="flex items-center gap-1.5">
            <FieldLabel htmlFor={id}>{field.label}</FieldLabel>
            {hint}
          </div>
          {description}
          {errorText}
        </FieldContent>
      </Field>
    )
  }

  if (field.widget === "radio") {
    return (
      <FieldSet data-invalid={invalid || undefined} {...legendName(id, field)}>
        <HintedLegend id={id} field={field} variant="label" />
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
        {...track}
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
        min={field.minimum}
        max={field.maximum}
        step={field.step ?? "any"}
        placeholder={field.placeholder}
        value={input.value ?? ""}
        onBlur={input.onBlur}
        onChange={(event) =>
          // Partial input ("-", "1e") reads as NaN: treat it as empty so
          // Zod reports "required", not a confusing type error.
          input.onChange(
            Number.isNaN(event.target.valueAsNumber)
              ? field.nullable
                ? null
                : undefined
              : event.target.valueAsNumber
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
        {...track}
        onChange={(event) =>
          input.onChange(
            event.target.value === "" && field.nullable
              ? null
              : event.target.value
          )
        }
        {...aria}
      />
    )
  }

  return (
    <Field data-invalid={invalid || undefined}>
      <div className="flex min-h-5 items-center justify-between gap-3">
        <LabelRow id={id} field={field} />
        {showCount ? (
          <span
            id={`${id}-count`}
            className={cn(
              "text-xs text-muted-foreground tabular-nums",
              length >= field.maxLength! && "text-warning"
            )}
          >
            {length}/{field.maxLength}
          </span>
        ) : null}
      </div>
      {control}
      {description}
      {errorText}
    </Field>
  )
}
