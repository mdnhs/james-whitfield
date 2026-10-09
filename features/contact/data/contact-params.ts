import { createSerializer, parseAsStringLiteral } from "nuqs/server"

import { FORMATS } from "@/features/services/data/services-content"
import { slugify } from "@/lib/utils"
import { CONTACT_FORM } from "./contact-content"

// The contact form can be opened pre-filled from a link elsewhere on the site:
// /contact?topic=sleep-rest&format=online&plan=change-programme. Values are
// slugs of the form's own options, so anything unknown is simply ignored.
// Read one way only: what a visitor picks in the form is never written back to
// the URL, since a topic like anxiety is personal.
const bySlug = <T>(items: T[], label: (item: T) => string) =>
  new Map(items.map((item) => [slugify(label(item)), item]))

export const TOPIC_BY_SLUG = bySlug(CONTACT_FORM.topics, (topic) => topic)
export const FORMAT_BY_SLUG = bySlug(CONTACT_FORM.formats, (format) => format)
export const PLAN_BY_SLUG = bySlug(FORMATS.plans, (plan) => plan.name)

export const contactParams = {
  topic: parseAsStringLiteral([...TOPIC_BY_SLUG.keys()]),
  format: parseAsStringLiteral([...FORMAT_BY_SLUG.keys()]),
  plan: parseAsStringLiteral([...PLAN_BY_SLUG.keys()]),
}

// Builds a pre-filled contact link: contactHref({ plan: "discovery-call" }).
const serialize = createSerializer(contactParams)
export const contactHref = (
  values: Partial<Record<keyof typeof contactParams, string>>
) => serialize("/contact", values)
