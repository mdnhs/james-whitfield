// server/modules/chat/knowledge.ts
import "server-only"

import { eq } from "drizzle-orm"

import { parseGlobal } from "@/lib/content/globals"
import { getDb } from "@/server/db/client"
import { pages } from "@/server/db/schema"
import { flattenBlocks } from "@/server/modules/ai/flatten"
import { oneLine } from "@/server/modules/ai/prompt"
import * as repo from "@/server/modules/content/repo"

export const KNOWLEDGE_MAX = 8000
const ELLIPSIS = "…"

type Contact = {
  email: string
  phone: string
  address: string
  hours: string
  clinic: string
}

// Text from settings and pages: one line and no leading `#`, so none of it
// can open a new `##` heading.
const clean = (text: string, max = KNOWLEDGE_MAX) =>
  oneLine(text, max).replace(/^#+\s*/, "")

export function buildKnowledge(input: {
  siteName: string
  sections: { title: string; text: string }[]
  contact: Contact
}) {
  const c = input.contact
  const contactLines = [
    `Practice: ${clean(input.siteName, 200)}`,
    c.clinic && `Clinic: ${clean(c.clinic, 400)}`,
    c.email && `Email: ${clean(c.email, 200)}`,
    c.phone && `Phone: ${clean(c.phone, 100)}`,
    c.address && `Address: ${clean(c.address, 300)}`,
    c.hours && `Hours: ${clean(c.hours, 400)}`,
  ].filter(Boolean)
  let out = `## Contact\n${contactLines.join("\n")}`
  for (const s of input.sections) {
    const title = clean(s.title, 200)
    const text = clean(s.text)
    if (!title && !text) continue
    const head = `\n\n## ${title}\n`
    if (out.length + head.length + text.length <= KNOWLEDGE_MAX) {
      out += head + text
      continue
    }
    // First section that does not fit: cut at a sentence, drop the rest.
    const room = KNOWLEDGE_MAX - out.length - head.length - ELLIPSIS.length
    if (room > 20) {
      const slice = text.slice(0, room)
      const cut = slice.lastIndexOf(". ")
      const body = (cut > 0 ? slice.slice(0, cut + 1) : slice).trimEnd()
      out += head + body + ELLIPSIS
    }
    break
  }
  return out
}

const PATHS = ["/", "/services", "/how-it-works", "/about", "/contact"]
const TTL_MS = 5 * 60_000
// A cache only: a cold process just rebuilds the text.
let cached: { at: number; text: string } | null = null

export const resetKnowledgeCache = () => {
  cached = null
}

const hasFaq = (doc: unknown) => {
  const blocks = (doc as { blocks?: unknown } | null)?.blocks
  return (
    Array.isArray(blocks) &&
    blocks.some((b) => (b as { type?: string } | null)?.type === "faq")
  )
}

const order = (path: string) => {
  const i = PATHS.indexOf(path)
  return i === -1 ? PATHS.length : i
}

export async function loadKnowledge(): Promise<string> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.text
  const db = getDb()
  const rows = await db
    .select({
      path: pages.path,
      title: pages.title,
      published: pages.published,
    })
    .from(pages)
    .where(eq(pages.status, "published"))
  const sections = rows
    .filter(
      (r) => r.published && (PATHS.includes(r.path) || hasFaq(r.published))
    )
    .sort((a, b) => order(a.path) - order(b.path))
    .map((r) => ({
      title: r.title,
      text: flattenBlocks(r.published, KNOWLEDGE_MAX).text,
    }))
    .filter((s) => s.text)
  // The FAQ block only holds a heading; the answers live in the collection.
  const faqs = await repo.listFaqs(db)
  if (faqs.length)
    sections.push({
      title: "Frequently asked questions",
      text: faqs.map((f) => `Q: ${f.question} A: ${f.answer}`).join(" "),
    })
  const site = parseGlobal("site", (await repo.findSetting("site", db))?.value)
  const contact = parseGlobal(
    "contact",
    (await repo.findSetting("contact", db))?.value
  )
  const a = contact.address
  const text = buildKnowledge({
    siteName: site.name,
    sections,
    contact: {
      email: contact.email,
      phone: contact.phone.display,
      address: [...a.lines, a.city, a.eircode, a.country]
        .filter(Boolean)
        .join(", "),
      hours: [contact.hours.summary, contact.hours.note]
        .filter(Boolean)
        .join(". "),
      clinic: [contact.clinic.name, contact.clinic.description]
        .filter(Boolean)
        .join(": "),
    },
  })
  cached = { at: Date.now(), text }
  return text
}
