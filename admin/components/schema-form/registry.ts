import * as z from "zod"

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

export type UiMeta = {
  label: string
  description?: string
  placeholder?: string
  widget?: Widget
  options?: readonly { value: string; label: string }[]
  inputType?: "text" | "email" | "password" | "url" | "tel"
  autoComplete?: string
}

export const ui = z.registry<UiMeta>()
