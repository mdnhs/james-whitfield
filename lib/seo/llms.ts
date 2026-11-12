// llms.txt (llmstxt.org): a markdown index of the site for language models.
// The `## Pages` / `## Articles` headings are format markers, not site copy.
export type LlmsEntry = {
  kind: "page" | "article"
  path: string
  title: string
  description: string
  noindex: boolean
}

export type LlmsInput = {
  name: string
  description: string
  origin: string
  entries: LlmsEntry[]
}

const line = (origin: string, e: LlmsEntry) => {
  const url = e.path === "/" ? origin : `${origin}${e.path}`
  const description = e.description.replace(/\s+/g, " ").trim()
  return `- [${e.title}](${url})${description ? `: ${description}` : ""}`
}

export function renderLlms({
  name,
  description,
  origin,
  entries,
}: LlmsInput): string {
  const seen = new Set<string>()
  const live = entries.filter((e) => {
    if (e.noindex || seen.has(e.path)) return false
    seen.add(e.path)
    return true
  })
  const section = (heading: string, kind: LlmsEntry["kind"]) => {
    const rows = live.filter((e) => e.kind === kind)
    return rows.length
      ? [`## ${heading}\n\n${rows.map((e) => line(origin, e)).join("\n")}`]
      : []
  }
  const head = description.trim()
    ? `# ${name}\n\n> ${description.trim()}`
    : `# ${name}`
  return (
    [head, ...section("Pages", "page"), ...section("Articles", "article")].join(
      "\n\n"
    ) + "\n"
  )
}
