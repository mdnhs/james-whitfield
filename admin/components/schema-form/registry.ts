import * as z from "zod"

import type { OptionSource } from "@/lib/content/collections"

// docs/brief.md §9.4: each Zod schema carries UI metadata in a registry,
// and toJSONSchema copies it into `x-ui`. Register last (after .optional()
// or .default()) so the metadata sits on the schema the form sees.
export type Widget =
  | "text"
  | "textarea"
  | "number"
  | "toggle"
  | "select"
  | "radio"
  | "list"
  | "group"
  | "media"
  | "link"
  | "icon"
  | "stat"
  | "richtext"
  | "collection"
  | "colour"
  | "focal"
  | "frame"

export type UiMeta = {
  // Optional: shared field schemas (field-ui.ts) take the field's own name.
  label?: string
  description?: string
  placeholder?: string
  widget?: Widget
  options?: readonly { value: string; label: string }[]
  inputType?: "text" | "email" | "password" | "url" | "tel"
  autoComplete?: string
  step?: number
  collection?: OptionSource
}

export const ui = z.registry<UiMeta>()
