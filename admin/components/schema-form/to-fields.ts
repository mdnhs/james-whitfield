import * as z from "zod"

import type { OptionSource } from "@/lib/content/collections"

import "./field-ui"
import { ui, type UiMeta, type Widget } from "./registry"

export type FieldOverrides = Readonly<Record<string, Partial<UiMeta>>>

export type JsonNode = {
  type?: string | string[]
  properties?: Record<string, JsonNode>
  required?: string[]
  items?: JsonNode
  enum?: unknown[]
  const?: unknown
  default?: unknown
  anyOf?: JsonNode[]
  oneOf?: JsonNode[]
  maxLength?: number
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  exclusiveMinimum?: number
  "x-ui"?: UiMeta
}

export type FormField = {
  name: string
  label: string
  widget: Widget
  required: boolean
  nullable?: boolean
  description?: string
  placeholder?: string
  inputType?: UiMeta["inputType"]
  autoComplete?: string
  maxLength?: number
  minItems?: number
  maxItems?: number
  minimum?: number
  maximum?: number
  step?: number
  options?: { value: string; label: string }[]
  fields?: FormField[]
  item?: FormField
  collection?: OptionSource
  // The field's JSON Schema, for widgets that build values.
  node: JsonNode
}

// Input shape (defaults make fields optional). Refinements are not
// representable and are dropped here; validation uses the Zod schema itself.
export function toJsonSchema(schema: z.ZodType): JsonNode {
  return z.toJSONSchema(schema, {
    io: "input",
    unrepresentable: "any",
    override: ({ zodSchema, jsonSchema }) => {
      const meta = ui.get(zodSchema)
      if (meta) (jsonSchema as Record<string, unknown>)["x-ui"] = meta
    },
  }) as JsonNode
}

// `X | null` arrives as anyOf [X, null]. A union with its own widget (stat,
// collection) stays whole.
function unwrap(node: JsonNode): { node: JsonNode; nullable: boolean } {
  const options = node.anyOf ?? node.oneOf
  if (!options || node["x-ui"]) return { node, nullable: false }
  const rest = options.filter((option) => option.type !== "null")
  if (rest.length === 1 && rest.length < options.length) {
    return {
      node: { ...rest[0]!, default: node.default ?? rest[0]!.default },
      nullable: true,
    }
  }
  return { node, nullable: false }
}

const humanise = (name: string) => {
  const last =
    name
      .split(".")
      .filter((part) => part !== "$")
      .at(-1) ?? ""
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
  return words ? words[0]!.toUpperCase() + words.slice(1).toLowerCase() : ""
}

const typeOf = (node: JsonNode) =>
  Array.isArray(node.type) ? node.type.find((t) => t !== "null") : node.type

function inferWidget(node: JsonNode): Widget {
  if (node.enum) return "select"
  switch (typeOf(node)) {
    case "boolean":
      return "toggle"
    case "number":
    case "integer":
      return "number"
    case "object":
      return "group"
    case "array":
      return "list"
    default:
      return (node.maxLength ?? 0) > 160 ? "textarea" : "text"
  }
}

function toField(
  raw: JsonNode,
  name: string,
  required: boolean,
  overrides: FieldOverrides
): FormField {
  const { node, nullable } = unwrap(raw)
  const meta: Partial<UiMeta> = { ...node["x-ui"], ...overrides[name] }
  const widget = meta.widget ?? inferWidget(node)
  const base: FormField = {
    name,
    widget,
    required: required && !nullable,
    nullable,
    label: meta.label ?? humanise(name),
    description: meta.description,
    placeholder: meta.placeholder,
    inputType: meta.inputType,
    autoComplete: meta.autoComplete,
    collection: meta.collection,
    node,
  }
  if (widget === "group")
    return { ...base, fields: fieldsOf(node, name, overrides) }
  if (widget === "list") {
    return {
      ...base,
      minItems: node.minItems,
      maxItems: node.maxItems,
      item: toField(node.items ?? {}, `${name}.$`, true, overrides),
    }
  }
  if (widget === "select" || widget === "radio" || widget === "icon") {
    return {
      ...base,
      options:
        meta.options?.map((option) => ({ ...option })) ??
        (node.enum ?? []).map((value) => ({
          value: String(value),
          label: humanise(String(value)),
        })),
    }
  }
  if (widget === "number") {
    return {
      ...base,
      minimum: node.minimum ?? node.exclusiveMinimum,
      maximum: node.maximum,
      step: meta.step ?? (typeOf(node) === "integer" ? 1 : undefined),
    }
  }
  return { ...base, maxLength: node.maxLength }
}

function fieldsOf(
  node: JsonNode,
  prefix: string,
  overrides: FieldOverrides
): FormField[] {
  const required = new Set(node.required ?? [])
  return Object.entries(node.properties ?? {}).map(([key, child]) =>
    toField(
      child,
      prefix ? `${prefix}.${key}` : key,
      required.has(key),
      overrides
    )
  )
}

export function toFields(
  schema: z.ZodObject,
  overrides: FieldOverrides = {}
): FormField[] {
  return fieldsOf(toJsonSchema(schema), "", overrides)
}

// A list item template is named "<list>.$…"; each rendered item swaps the
// placeholder for its index.
export function rebase(field: FormField, from: string, to: string): FormField {
  const swap = (name: string) =>
    name.startsWith(from) ? to + name.slice(from.length) : name
  return {
    ...field,
    name: swap(field.name),
    fields: field.fields?.map((child) => rebase(child, from, to)),
    item: field.item && rebase(field.item, from, to),
  }
}

// A value with every key present, for "Add" buttons and new blocks. It is a
// starting point, not a valid value (required text is empty, images unset).
export function emptyValue(raw: JsonNode): unknown {
  if (raw.default !== undefined) return structuredClone(raw.default)
  const { node, nullable } = unwrap(raw)
  if (nullable) return null
  const options = node.anyOf ?? node.oneOf
  if (options?.length) return emptyValue(options[0]!)
  if (node.const !== undefined) return node.const
  if (node.enum) return node.enum[0]
  switch (typeOf(node)) {
    case "object":
      return Object.fromEntries(
        Object.entries(node.properties ?? {}).map(([key, child]) => [
          key,
          emptyValue(child),
        ])
      )
    case "array":
      return Array.from({ length: node.minItems ?? 0 }, () =>
        emptyValue(node.items ?? {})
      )
    case "number":
    case "integer":
      return node.minimum ?? 0
    case "boolean":
      return false
    case "string":
      return ""
    default:
      return null
  }
}

export const emptyValueFor = (schema: z.ZodType) =>
  emptyValue(toJsonSchema(schema))
