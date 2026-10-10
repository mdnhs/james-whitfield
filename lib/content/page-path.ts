import * as z from "zod"

// First segments the platform or a named route already owns. Custom pages
// live one segment deep (app/(site)/[page]); system pages keep their routes.
export const RESERVED_SEGMENTS = [
  "admin",
  "api",
  "uploads",
  "images",
  "og",
  "site-icon",
  "insights",
] as const

// The [page] route's build shell. The pattern below cannot produce it.
export const PAGE_SHELL_SEGMENT = "__page"

export const CustomPagePath = z
  .string()
  .trim()
  .max(61)
  .regex(
    /^\/[a-z0-9]+(?:-[a-z0-9]+)*$/,
    "Use one lower-case segment, e.g. /team"
  )
  .refine(
    (path) => !(RESERVED_SEGMENTS as readonly string[]).includes(path.slice(1)),
    "That address is reserved"
  )

// Where the preview endpoint may send a browser: a site path, never another
// origin ("//x", "/\x", "https://x") and no query string.
export const PreviewPath = z
  .string()
  .max(200)
  .regex(
    /^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*)?$/,
    "Use an internal path, e.g. /about"
  )

export const NewPageInput = z.object({
  path: CustomPagePath,
  title: z.string().trim().min(1).max(80),
})
export type NewPageInput = z.infer<typeof NewPageInput>
