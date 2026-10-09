import * as z from "zod"

import { ui, type UiMeta, type Widget } from "./registry"

export type FormField = {
  name: string
  label: string
  widget: Widget
  required: boolean
  description?: string
  placeholder?: string
  inputType?: UiMeta["inputType"]
  autoComplete?: string
  maxLength?: number
  minItems?: number
  maxItems?: number
  options?: { value: string; label: string }[]
  fields?: FormField[]
  item?: FormField
}

type JsonNode = {
  type?: string | string[]
  properties?: Record<string, JsonNode>
  required?: string[]
  items?: JsonNode
  enum?: unknown[]
  maxLength?: number
  minItems?: number
  maxItems?: number
  "x-ui"?: UiMeta
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

const humanise = (name: string) => {
  const last = name.split(".").at(-1) ?? ""
  const words = last
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]/g, " ")
  return words ? words[0]!.toUpperCase() + words.slice(1).toLowerCase() : ""
}

function inferWidget(node: JsonNode): Widget {
  if (node.enum) return "select"
  const type = Array.isArray(node.type)
    ? node.type.find((t) => t !== "null")
    : node.type
  switch (type) {
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

function toField(node: JsonNode, name: string, required: boolean): FormField {
  const meta = node["x-ui"]
  const widget = meta?.widget ?? inferWidget(node)
  const base: FormField = {
    name,
    widget,
    required,
    label: meta?.label ?? humanise(name),
    description: meta?.description,
    placeholder: meta?.placeholder,
    inputType: meta?.inputType,
    autoComplete: meta?.autoComplete,
  }
  if (widget === "group") return { ...base, fields: fieldsOf(node, name) }
  if (widget === "list") {
    return {
      ...base,
      minItems: node.minItems,
      maxItems: node.maxItems,
      item: toField(node.items ?? {}, "", true),
    }
  }
  if (widget === "select" || widget === "radio") {
    return {
      ...base,
      options:
        meta?.options?.map((option) => ({ ...option })) ??
        (node.enum ?? []).map((value) => ({
          value: String(value),
          label: humanise(String(value)),
        })),
    }
  }
  return { ...base, maxLength: node.maxLength }
}

function fieldsOf(node: JsonNode, prefix: string): FormField[] {
  const required = new Set(node.required ?? [])
  return Object.entries(node.properties ?? {}).map(([key, child]) =>
    toField(child, prefix ? `${prefix}.${key}` : key, required.has(key))
  )
}

export function toFields(schema: z.ZodObject): FormField[] {
  return fieldsOf(toJsonSchema(schema), "")
}
