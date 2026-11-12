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

// Service landing pages nest one level under the system /services page.
const SERVICES_SEGMENT = "services"
const SERVICE_PREFIX = `/${SERVICES_SEGMENT}/`

export function isServicePagePath(path: string): boolean {
  return CUSTOM_PAGE_SHAPE.test(path) && path.startsWith(SERVICE_PREFIX)
}

const CUSTOM_PAGE_SHAPE = /^\/(?:services\/)?[a-z0-9]+(?:-[a-z0-9]+)*$/

export const CustomPagePath = z
  .string()
  .trim()
  .max(71)
  .regex(
    CUSTOM_PAGE_SHAPE,
    "Use one lower-case segment, e.g. /team, or /services/<segment>"
  )
  .refine(
    (path) =>
      isServicePagePath(path) ||
      !([...RESERVED_SEGMENTS, SERVICES_SEGMENT] as readonly string[]).includes(
        path.slice(1)
      ),
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
