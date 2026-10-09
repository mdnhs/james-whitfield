import { createSerializer, parseAsString } from "nuqs/server"

// Links that open the contact form pre-filled. The keys and their order match
// what the form reads (features/contact/lib/contact-params.ts), so the URLs
// are exactly the ones the site used before.
const serialize = createSerializer({
  topic: parseAsString,
  format: parseAsString,
  plan: parseAsString,
})

export const contactHref = (values: {
  topic?: string | null
  format?: string | null
  plan?: string | null
}) => serialize("/contact", values)
