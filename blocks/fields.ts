// blocks/fields.ts
import * as z from "zod"

import type { StatValue as StatValueType } from "@/lib/count"
import { ICON_NAMES } from "@/lib/icons"

// Limits are what the design can carry (docs/brief.md §5.7 rule 7): longer
// copy or more items wrap into layouts that were never drawn for them.
export const text = (max: number) => z.string().trim().min(1).max(max)
export const optionalText = (max: number) => z.string().trim().max(max)

// Section ids: unique per page (blocks/page.ts) and used by the JourneyRail.
export const Anchor = z
  .string()
  .max(40)
  .regex(
    /^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/,
    "Use lower-case kebab-case, e.g. how-it-works"
  )

// Site paths, in-page anchors, https, mailto and tel only, so no
// javascript: or protocol-relative URL can reach an href.
export const Href = z
  .string()
  .trim()
  .max(300)
  .regex(
    /^(\/(?!\/)|#[a-z]|https:\/\/|mailto:|tel:)/i,
    "Use /path, #anchor, https://, mailto: or tel:"
  )
  // No backslashes or control characters (browsers strip tabs/newlines and
  // treat "\" as "/", which turns "/\evil.example" into a protocol-relative URL).
  // eslint-disable-next-line no-control-regex
  .refine(
    (v) => !/[\\\u0000-\u001f\u007f]/.test(v),
    "Remove backslashes and control characters"
  )

// Absolute https URLs only (social profiles, schema.org sameAs).
export const HttpsUrl = z
  .url()
  .max(300)
  .refine((v) => v.toLowerCase().startsWith("https://"), "Use an https:// URL")

export const LinkValue = z.object({ label: text(60), href: Href })
export const MediaRef = z.object({ mediaId: z.uuid() })
export const Focal = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
})
export const Tint = z.number().min(0).max(0.9)
export const IconField = z.enum(ICON_NAMES)

export const StatValue = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("count"),
    value: z.number().nonnegative().max(1e9),
    decimals: z.number().int().min(0).max(2),
    prefix: z.string().max(4),
    suffix: z.string().max(8),
  }),
  z.object({ kind: z.literal("text"), text: text(16) }),
]) satisfies z.ZodType<StatValueType>

export const Stat = z.object({ value: StatValue, label: text(60) })

export const Selection = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all") }),
  z.object({
    mode: z.literal("chosen"),
    ids: z.array(z.uuid()).min(1).max(24),
  }),
])

export const Variant = z.enum(["home", "page"])
