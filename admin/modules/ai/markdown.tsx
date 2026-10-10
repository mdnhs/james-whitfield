// admin/modules/ai/markdown.tsx
import Link from "next/link"
import type { ReactNode } from "react"

// A small, safe Markdown subset for assistant replies: paragraphs, headings
// (drawn as bold paragraphs, so a reply never adds to the page outline),
// lists, fenced code, inline code, bold, italic and links. Everything else,
// raw HTML included, stays text: React escapes it, and nothing here sets
// innerHTML. The admin had no renderer to reuse.
type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; text: string }
  | { kind: "ul" | "ol"; items: string[] }
  | { kind: "code"; text: string }

export function parseBlocks(source: string): Block[] {
  const lines = source.replace(/\r\n?/g, "\n").split("\n")
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ kind: "p", text: para.join(" ") })
    para = []
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!
    if (line.startsWith("```")) {
      flush()
      const code: string[] = []
      for (i++; i < lines.length && !lines[i]!.startsWith("```"); i++)
        code.push(lines[i]!)
      blocks.push({ kind: "code", text: code.join("\n") })
      continue
    }
    const heading = /^#{1,6}\s+(.*)$/.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: "h", text: heading[1]! })
      continue
    }
    const item = /^\s*([-*+]|\d+[.)])\s+(.*)$/.exec(line)
    if (item) {
      flush()
      const kind = /\d/.test(item[1]!) ? "ol" : "ul"
      const last = blocks.at(-1)
      if (last && last.kind === kind) last.items.push(item[2]!)
      else blocks.push({ kind, items: [item[2]!] })
      continue
    }
    if (!line.trim()) flush()
    else para.push(line.trim())
  }
  flush()
  return blocks
}

// Relative paths, https and mailto only: no http, javascript:, data: or
// protocol-relative (`//host`, `/\host`) targets. Two more are refused, since
// a click on text the model wrote (and a page could steer) must not reach the
// API, where a GET can download the enquiries or a privacy export, or open a
// prefilled email: `/api/` paths, and `mailto:` with a query (subject, body,
// cc). A plain `mailto:address` is fine.
export function safeHref(raw: string): string | null {
  if (/[\u0000-\u001f\u007f]/.test(raw)) return null
  if (raw.startsWith("/")) {
    if (/^\/[/\\]/.test(raw)) return null
    // Resolve dot segments and decode before looking at the path.
    let path: string
    try {
      path = decodeURIComponent(new URL(raw, "https://admin.invalid").pathname)
    } catch {
      return null
    }
    return /^\/api(\/|$)/i.test(path) ? null : raw
  }
  try {
    const url = new URL(raw)
    if (url.protocol === "mailto:")
      return url.search || raw.includes("?") ? null : url.href
    return url.protocol === "https:" ? url.href : null
  } catch {
    return null
  }
}

const INLINE =
  /(`[^`]+`)|(\*\*[^*]+\*\*)|(\*[^*\s][^*]*\*|_[^_\s][^_]*_)|(\[[^\]]+\]\([^)\s]+\))/g

function inline(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  let key = 0
  for (const m of text.matchAll(INLINE)) {
    if (m.index > last) out.push(text.slice(last, m.index))
    const t = m[0]
    if (m[1])
      out.push(
        <code
          key={key++}
          className="rounded bg-muted px-1 font-mono text-[0.85em]"
        >
          {t.slice(1, -1)}
        </code>
      )
    else if (m[2])
      out.push(<strong key={key++}>{inline(t.slice(2, -2))}</strong>)
    else if (m[3]) out.push(<em key={key++}>{inline(t.slice(1, -1))}</em>)
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!
      const safe = safeHref(href!)
      out.push(
        !safe ? (
          `${label} (${href})`
        ) : safe.startsWith("/") ? (
          // Same-site: client navigation, so the open sheet survives it.
          <Link
            key={key++}
            href={safe}
            className="underline underline-offset-2"
          >
            {label}
          </Link>
        ) : (
          <a
            key={key++}
            href={safe}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className="underline underline-offset-2"
          >
            {label}
          </a>
        )
      )
    }
    last = m.index + t.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}

export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex flex-col gap-2 leading-relaxed">
      {parseBlocks(text).map((block, i) => {
        if (block.kind === "h")
          return (
            <p key={i} className="font-semibold">
              {inline(block.text)}
            </p>
          )
        if (block.kind === "code")
          return (
            <pre
              key={i}
              className="overflow-x-auto rounded-md bg-muted p-3 text-xs"
            >
              <code>{block.text}</code>
            </pre>
          )
        if (block.kind === "p") return <p key={i}>{inline(block.text)}</p>
        const List = block.kind
        return (
          <List
            key={i}
            className={List === "ul" ? "list-disc pl-5" : "list-decimal pl-5"}
          >
            {block.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
