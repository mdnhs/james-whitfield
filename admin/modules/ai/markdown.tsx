// admin/modules/ai/markdown.tsx
"use client"

import { CheckIcon, CopyIcon } from "lucide-react"
import Link from "next/link"
import type { ReactNode } from "react"

import { Button } from "@/components/ui/button"

import { useCopy } from "./use-copy"

// A safe Markdown subset for assistant replies: paragraphs, headings (drawn
// as styled paragraphs, so a reply never adds to the page outline), lists,
// block quotes, tables, rules, fenced code, inline code, bold, italic and
// links. Everything else, raw HTML included, stays text: React escapes it,
// and nothing here sets innerHTML. The admin had no renderer to reuse.
type Align = "left" | "center" | "right" | null
export type Block =
  | { kind: "p"; text: string }
  | { kind: "h"; level: number; text: string }
  | { kind: "ul"; items: string[] }
  | { kind: "ol"; items: string[]; start: number }
  | { kind: "code"; lang: string; text: string }
  | { kind: "quote"; paragraphs: string[] }
  | { kind: "table"; head: string[]; align: Align[]; rows: string[][] }
  | { kind: "hr" }

const FENCE = /^\s{0,3}(`{3,}|~{3,})\s*([^\s`]*)/
const HEADING = /^\s{0,3}(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/
const RULE = /^\s{0,3}([-*_])(?:\s*\1){2,}\s*$/
const ITEM = /^\s*([-*+]|\d{1,9}[.)])\s+(.*)$/
const QUOTE = /^\s{0,3}>\s?(.*)$/
const TABLE_RULE = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/

// A label like "ts" or "c++"; anything stranger is just "Code".
const langOf = (raw: string) => (/^[\w+#.-]{1,20}$/.test(raw) ? raw : "")

function cells(line: string): string[] {
  let row = line.trim()
  if (row.startsWith("|")) row = row.slice(1)
  if (row.endsWith("|") && !row.endsWith("\\|")) row = row.slice(0, -1)
  return row.split(/(?<!\\)\|/).map((c) => c.trim().replace(/\\\|/g, "|"))
}

const alignOf = (cell: string): Align =>
  cell.startsWith(":") && cell.endsWith(":")
    ? "center"
    : cell.endsWith(":")
      ? "right"
      : cell.startsWith(":")
        ? "left"
        : null

function isTableStart(lines: string[], i: number) {
  const head = lines[i]!
  const rule = lines[i + 1]
  if (!head.includes("|") || rule === undefined || !rule.includes("-"))
    return false
  if (!TABLE_RULE.test(rule)) return false
  return cells(head).length === cells(rule).length
}

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
    const fence = FENCE.exec(line)
    if (fence) {
      flush()
      const marker = fence[1]!
      const code: string[] = []
      for (i++; i < lines.length && !lines[i]!.trim().startsWith(marker); i++)
        code.push(lines[i]!)
      blocks.push({
        kind: "code",
        lang: langOf(fence[2]!),
        text: code.join("\n"),
      })
      continue
    }
    const heading = HEADING.exec(line)
    if (heading) {
      flush()
      blocks.push({ kind: "h", level: heading[1]!.length, text: heading[2]! })
      continue
    }
    if (RULE.test(line)) {
      flush()
      blocks.push({ kind: "hr" })
      continue
    }
    if (isTableStart(lines, i)) {
      flush()
      const head = cells(line)
      const align = cells(lines[i + 1]!).map(alignOf)
      const rows: string[][] = []
      for (i += 2; i < lines.length && lines[i]!.includes("|"); i++) {
        if (!lines[i]!.trim()) break
        const row = cells(lines[i]!).slice(0, head.length)
        while (row.length < head.length) row.push("")
        rows.push(row)
      }
      i--
      blocks.push({ kind: "table", head, align, rows })
      continue
    }
    const quote = QUOTE.exec(line)
    if (quote) {
      flush()
      const paragraphs: string[] = []
      let current: string[] = []
      for (; i < lines.length; i++) {
        const q = QUOTE.exec(lines[i]!)
        if (!q) break
        if (q[1]!.trim()) current.push(q[1]!.trim())
        else if (current.length) {
          paragraphs.push(current.join(" "))
          current = []
        }
      }
      i--
      if (current.length) paragraphs.push(current.join(" "))
      blocks.push({ kind: "quote", paragraphs })
      continue
    }
    const item = ITEM.exec(line)
    if (item) {
      flush()
      const ordered = /\d/.test(item[1]!)
      const last = blocks.at(-1)
      if (last && last.kind === (ordered ? "ol" : "ul"))
        (last as { items: string[] }).items.push(item[2]!)
      else if (ordered)
        blocks.push({
          kind: "ol",
          items: [item[2]!],
          start: Number.parseInt(item[1]!, 10) || 1,
        })
      else blocks.push({ kind: "ul", items: [item[2]!] })
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
const LINK = "font-medium text-primary underline underline-offset-2"

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
          className="rounded-md border bg-card px-1 py-px font-mono text-[0.85em]"
        >
          {t.slice(1, -1)}
        </code>
      )
    else if (m[2])
      out.push(
        <strong key={key++} className="font-semibold">
          {inline(t.slice(2, -2))}
        </strong>
      )
    else if (m[3]) out.push(<em key={key++}>{inline(t.slice(1, -1))}</em>)
    else {
      const [, label, href] = /^\[([^\]]+)\]\(([^)\s]+)\)$/.exec(t)!
      const safe = safeHref(href!)
      out.push(
        !safe ? (
          `${label} (${href})`
        ) : safe.startsWith("/") ? (
          // Same-site: client navigation, so the open sheet survives it.
          <Link key={key++} href={safe} className={LINK}>
            {label}
          </Link>
        ) : (
          <a
            key={key++}
            href={safe}
            target="_blank"
            rel="noopener noreferrer nofollow"
            className={LINK}
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

function CodeBlock({ lang, text }: { lang: string; text: string }) {
  const { copied, copy } = useCopy()
  const label = lang || "Code"
  return (
    <div className="overflow-hidden rounded-xl border bg-card">
      <div className="flex items-center justify-between gap-2 border-b py-1 pr-1 pl-3">
        <span className="font-mono text-xs text-muted-foreground">{label}</span>
        <Button
          variant="ghost"
          size="xs"
          aria-label={copied ? "Copied" : `Copy ${lang ? `${lang} ` : ""}code`}
          onClick={() => void copy(text)}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          {copied ? "Copied" : "Copy"}
        </Button>
      </div>
      <pre
        // Scrolls sideways: reachable by keyboard (WCAG 2.1.1).
        tabIndex={0}
        role="region"
        aria-label={`${label} block`}
        className="overflow-x-auto p-3 font-mono text-[0.8125rem] leading-relaxed outline-none focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:ring-inset"
      >
        <code>{text}</code>
      </pre>
    </div>
  )
}

const ALIGN = { left: "text-left", center: "text-center", right: "text-right" }

function Table({ block }: { block: Extract<Block, { kind: "table" }> }) {
  const align = (i: number) => ALIGN[block.align[i] ?? "left"]
  return (
    <div
      tabIndex={0}
      role="region"
      aria-label="Table"
      className="max-w-full overflow-x-auto rounded-xl border bg-card outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <table className="w-full border-collapse text-[0.8125rem]">
        <thead className="bg-muted/60">
          <tr>
            {block.head.map((cell, i) => (
              <th
                key={i}
                scope="col"
                className={`px-3 py-2 font-semibold ${align(i)}`}
              >
                {inline(cell)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r} className="border-t align-top">
              {row.map((cell, i) => (
                <td key={i} className={`px-3 py-2 ${align(i)}`}>
                  {inline(cell)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

const HEADING_CLASS = [
  "",
  "mt-2 text-[1.0625rem] font-semibold tracking-tight",
  "mt-2 text-base font-semibold tracking-tight",
  "mt-1 font-semibold",
]

export function Markdown({ text }: { text: string }) {
  return (
    <div className="flex min-w-0 flex-col gap-3 leading-relaxed">
      {parseBlocks(text).map((block, i) => {
        switch (block.kind) {
          case "h":
            return (
              <p
                key={i}
                className={HEADING_CLASS[block.level] ?? "font-semibold"}
              >
                {inline(block.text)}
              </p>
            )
          case "code":
            return <CodeBlock key={i} lang={block.lang} text={block.text} />
          case "table":
            return <Table key={i} block={block} />
          case "hr":
            return <hr key={i} className="my-1 border-border" />
          case "quote":
            return (
              <blockquote
                key={i}
                className="flex flex-col gap-2 border-l-2 border-primary/60 pl-3 text-muted-foreground"
              >
                {block.paragraphs.map((p, j) => (
                  <p key={j}>{inline(p)}</p>
                ))}
              </blockquote>
            )
          case "p":
            return <p key={i}>{inline(block.text)}</p>
          case "ul":
            return (
              <ul
                key={i}
                className="flex list-disc flex-col gap-1 pl-5 marker:text-primary"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ul>
            )
          case "ol":
            return (
              <ol
                key={i}
                start={block.start === 1 ? undefined : block.start}
                className="flex list-decimal flex-col gap-1 pl-5 marker:text-muted-foreground"
              >
                {block.items.map((item, j) => (
                  <li key={j}>{inline(item)}</li>
                ))}
              </ol>
            )
        }
      })}
    </div>
  )
}
