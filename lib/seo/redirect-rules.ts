import * as z from "zod"

export const REDIRECT_STATUSES = [301, 302, 307, 308] as const

// Paths the platform owns or that never reach the resolver (proxy matcher).
const RESERVED = /^\/(?:admin|api|_next|uploads|images|og|newsletter)(?:\/|$)/
const FILES = new Set([
  "/favicon.ico",
  "/robots.txt",
  "/sitemap.xml",
  "/manifest.webmanifest",
])

// Stored exactly as proxy sees request.nextUrl.pathname: URL-safe characters
// only, no query, no trailing slash (Next 308s that away first).
export const RedirectSource = z
  .string()
  .trim()
  .max(300)
  .transform((v) => (v.length > 1 ? v.replace(/\/+$/, "") : v))
  .refine(
    (v) => /^\/[A-Za-z0-9\-._~%/]*$/.test(v) && !v.startsWith("//"),
    "Use a path on this site, e.g. /old-page"
  )
  .refine((v) => v !== "/", "The home page can't redirect")
  .refine((v) => !RESERVED.test(v) && !FILES.has(v), "That address is reserved")

// Ruling R4: site paths only, optionally with a query string.
export const RedirectDestination = z
  .string()
  .trim()
  .max(500)
  .refine(
    (v) => /^\/(?![/\\])[^\s\\#]*$/.test(v),
    "Use a path on this site, e.g. /new-page"
  )

const Status = z.union(
  REDIRECT_STATUSES.map((s) => z.literal(s)) as [
    z.ZodLiteral<301>,
    z.ZodLiteral<302>,
    z.ZodLiteral<307>,
    z.ZodLiteral<308>,
  ]
)

export const RedirectInput = z.object({
  sourcePath: RedirectSource,
  destination: RedirectDestination,
  statusCode: Status.default(301),
  note: z.string().trim().max(200).default(""),
})
export type RedirectInput = z.infer<typeof RedirectInput>

export const RedirectPatch = z
  .object({
    destination: RedirectDestination.optional(),
    statusCode: Status.optional(),
    isActive: z.boolean().optional(),
    note: z.string().trim().max(200).optional(),
  })
  .strict()
  .refine((v) => Object.keys(v).length > 0, "Nothing to change")
export type RedirectPatch = z.infer<typeof RedirectPatch>

export const RedirectListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
})
export type RedirectListQuery = z.infer<typeof RedirectListQuery>
