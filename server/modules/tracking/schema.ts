import "server-only"

import * as z from "zod"

export const TrackingUpdate = z.object({
  version: z.number().int().min(0),
  value: z.object({
    gtmId: z.string().max(30),
    ga4Id: z.string().max(30),
    metaPixelId: z.string().max(30),
    testEventCode: z.string().max(40),
    enabled: z.object({
      gtm: z.boolean(),
      ga4: z.boolean(),
      meta: z.boolean(),
      capi: z.boolean(),
    }),
  }),
  // Omitted: keep. null: remove. A string: replace (write-only, §12.5).
  capiToken: z.string().trim().min(20).max(500).nullable().optional(),
  enhancedMatching: z
    .object({ enabled: z.boolean(), acknowledge: z.boolean().optional() })
    .optional(),
})
export type TrackingUpdate = z.infer<typeof TrackingUpdate>
