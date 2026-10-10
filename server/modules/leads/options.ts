import "server-only"

import { asc, eq } from "drizzle-orm"

import { slugify } from "@/lib/utils"
import { getDb } from "@/server/db/client"
import { plans, services } from "@/server/db/schema"
import { getGlobal } from "@/server/modules/globals/service"

type Option = { slug: string; label: string }
type Options = { topics: Option[]; formats: Option[]; plans: Option[] }

// Ruling R8: exactly the options the contact form renders (resolve-block.tsx
// "contact.details"): visible services then the extra topics, the formats,
// and the visible plans. Read uncached: this runs in a Route Handler.
async function loadOptions(): Promise<Options> {
  const db = getDb()
  const [serviceRows, planRows, { value: form }] = await Promise.all([
    db
      .select({ slug: services.slug, label: services.title })
      .from(services)
      .where(eq(services.isVisible, true))
      .orderBy(asc(services.sort)),
    db
      .select({ slug: plans.slug, label: plans.name })
      .from(plans)
      .where(eq(plans.isVisible, true))
      .orderBy(asc(plans.sort)),
    getGlobal("contactForm"),
  ])
  const option = (label: string) => ({ slug: slugify(label), label })
  return {
    topics: [...serviceRows, ...form.extraTopics.map(option)],
    formats: form.formats.map(option),
    plans: planRows,
  }
}

const slugs = (list: Option[]) => new Set(list.map((o) => o.slug))

export async function allowedOptions() {
  const options = await loadOptions()
  return {
    topics: slugs(options.topics),
    formats: slugs(options.formats),
    plans: slugs(options.plans),
  }
}

// Display labels for the stored slugs; a since-renamed or removed option
// falls back to its slug.
export async function optionLabels(lead: {
  topicSlug: string
  formatSlug: string | null
  planSlug: string | null
}) {
  const options = await loadOptions()
  const label = (list: Option[], slug: string) =>
    list.find((o) => o.slug === slug)?.label ?? slug
  return {
    topic: label(options.topics, lead.topicSlug),
    format: lead.formatSlug ? label(options.formats, lead.formatSlug) : null,
    plan: lead.planSlug ? label(options.plans, lead.planSlug) : null,
  }
}
