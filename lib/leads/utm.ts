// Kept apart from schema.ts so the attribution capture in the site layout
// ships without Zod.
export const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
] as const
