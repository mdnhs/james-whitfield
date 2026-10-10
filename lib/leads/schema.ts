import * as z from "zod"

import { Slug } from "@/lib/content/slug"

import { UTM_KEYS } from "./utm"

export const LEAD_STATUSES = [
  "new",
  "contacted",
  "booked",
  "closed",
  "spam",
] as const
export type LeadStatus = (typeof LEAD_STATUSES)[number]
export const BOARD_STATUSES = ["new", "contacted", "booked", "closed"] as const
export const ACTIVITY_TYPES = ["note", "status", "email", "assignment"] as const
export { UTM_KEYS }

// The consent record kept with each lead (docs/brief.md §13 "consent snapshot").
export type ConsentRecord = {
  privacyText?: string
  analytics?: boolean
  marketing?: boolean
  version?: number | null
}

const PHONE_SHAPE = /^[+()\d\s.-]{6,20}$/
const Email = z.string().trim().toLowerCase().max(254).pipe(z.email())

export const LeadInput = z.object({
  name: z.string().trim().min(1).max(120),
  email: Email,
  phone: z
    .string()
    .trim()
    .max(40)
    .transform((v) => v || undefined)
    .pipe(z.string().regex(PHONE_SHAPE).optional())
    .optional(),
  topic: Slug,
  format: Slug.optional(),
  plan: Slug.optional(),
  message: z.string().trim().max(5000).default(""),
  consent: z.literal(true),
})
export type LeadInput = z.infer<typeof LeadInput>

export const Attribution = z
  .object({
    referrer: z.string().max(500).default(""),
    landingPath: z.string().max(300).default(""),
    utm: z.partialRecord(z.enum(UTM_KEYS), z.string().max(200)).default({}),
  })
  .prefault({})

const Hidden = {
  website: z.string().max(200).default(""), // honeypot
  stamp: z.string().max(200).default(""),
  eventId: z.uuid().optional(),
  sourcePath: z
    .string()
    .max(300)
    .regex(/^\/(?!\/)/)
    .default("/"),
  attribution: Attribution,
  turnstileToken: z.string().max(2048).optional(),
  // The browser's marketing consent at submit time (docs/brief.md §12.5); the
  // server re-checks the cookie before anything reaches Meta (Ruling R9).
  marketingConsent: z.boolean().default(false),
}
export const LeadSubmission = LeadInput.extend(Hidden)
export type LeadSubmission = z.infer<typeof LeadSubmission>

export const NewsletterSubmission = z.object({
  email: Email,
  website: Hidden.website,
  sourcePath: Hidden.sourcePath,
})

export const LeadPatch = z
  .object({
    status: z.enum(LEAD_STATUSES).optional(),
    assignedTo: z.uuid().nullable().optional(),
  })
  .refine(
    (v) => v.status !== undefined || v.assignedTo !== undefined,
    "Nothing to change"
  )
export const LeadNote = z.object({ body: z.string().trim().min(1).max(5000) })
export const LeadListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  folder: z.enum(["inbox", "spam"]).default("inbox"),
  status: z.enum(BOARD_STATUSES).optional(),
  assignee: z.union([z.uuid(), z.literal("me"), z.literal("none")]).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(["createdAt:desc", "createdAt:asc"]).default("createdAt:desc"),
})
export type LeadListQuery = z.infer<typeof LeadListQuery>

export const SUBSCRIBER_STATUSES = [
  "pending",
  "confirmed",
  "unsubscribed",
] as const
export type SubscriberStatus = (typeof SUBSCRIBER_STATUSES)[number]
export const SubscriberListQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(25),
  status: z.enum(SUBSCRIBER_STATUSES).optional(),
  q: z.string().trim().max(100).optional(),
})
export type SubscriberListQuery = z.infer<typeof SubscriberListQuery>
export const SubscriberExportQuery = z.object({
  status: z.enum(["all", "confirmed"]).default("confirmed"),
})
