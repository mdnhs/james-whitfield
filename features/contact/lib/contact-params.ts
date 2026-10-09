import { parseAsStringLiteral } from "nuqs"

import type { ContactOption, PlanOption } from "@/lib/content/types"

// Values in the URL are slugs of the form's own options; anything unknown is
// ignored. Read one way only: choices are never written back to the URL,
// because a topic like anxiety is personal.
export const contactParams = (
  topics: ContactOption[],
  formats: ContactOption[],
  plans: PlanOption[]
) => ({
  topic: parseAsStringLiteral(topics.map((t) => t.slug)),
  format: parseAsStringLiteral(formats.map((f) => f.slug)),
  plan: parseAsStringLiteral(plans.map((p) => p.slug)),
})
