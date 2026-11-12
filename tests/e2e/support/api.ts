import type { APIRequestContext } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"
import { runSql } from "./db"

type Method = "GET" | "POST" | "PATCH" | "PUT" | "DELETE"

// Admin API calls from a signed-in storage state. sameOrigin() needs Origin.
export async function api<T>(
  request: APIRequestContext,
  method: Method,
  path: string,
  data?: unknown
): Promise<T> {
  const response = await request.fetch(`/api/v1/admin${path}`, {
    method,
    data,
    headers: { origin: E2E_ORIGIN },
  })
  if (!response.ok()) {
    throw new Error(
      `${method} ${path} → ${response.status()} ${await response.text()}`
    )
  }
  return (await response.json()) as T
}

export const richTextDocument = (text: string) => ({
  blocks: [
    {
      id: "e2e-content",
      type: "richtext",
      anchor: "content",
      chapter: null,
      hidden: false,
      joinPrevious: false,
      data: {
        doc: {
          type: "doc",
          content: [{ type: "paragraph", content: [{ type: "text", text }] }],
        },
        width: "narrow",
      },
    },
  ],
})

export type PageBlock = {
  id: string
  type: string
  anchor: string
  chapter: string | null
  hidden: boolean
  joinPrevious: boolean
  data: Record<string, unknown>
}
export type PageDocument = { blocks: PageBlock[] }

const stamp = () => `${Date.now()}-${Math.floor(Math.random() * 1e4)}`

// A visible service of its own per test: its details page only shows while
// the service does. The E2E database is reseeded every run, so the extra
// card on /services never reaches a parity run.
export async function createService(
  request: APIRequestContext,
  title = `E2E service ${stamp()}`
) {
  const slug = `e2e-${stamp()}`
  const { id } = await api<{ id: string }>(
    request,
    "POST",
    "/collections/services",
    {
      values: {
        slug,
        title,
        body: "A service written by the E2E suite.",
        icon: "mind",
        isVisible: true,
      },
    }
  )
  return { id, slug, title }
}

// Sections are fixed, so a draft only ever changes block data: this sets the
// hero's subtitle and keeps everything else as the template made it.
export const withHeroSubtitle = (
  document: PageDocument,
  subtitle: string
): PageDocument => ({
  blocks: document.blocks.map((block) =>
    block.type === "hero.page"
      ? { ...block, data: { ...block.data, subtitle } }
      : block
  ),
})

// A fresh service details page per test (the only kind of page the admin
// creates), with `text` as its hero subtitle, published. Specs never touch
// seeded pages (parity).
export async function createPublishedPage(
  request: APIRequestContext,
  text: string,
  { title }: { title?: string } = {}
) {
  const service = await createService(request, title)
  const { pageId: id, path } = await api<{ pageId: string; path: string }>(
    request,
    "POST",
    `/service-pages/${service.id}`
  )
  const page = await api<{ version: number; draft: PageDocument }>(
    request,
    "GET",
    `/pages/${id}`
  )
  const saved = await api<{ version: number }>(
    request,
    "PATCH",
    `/pages/${id}/draft`,
    { version: page.version, document: withHeroSubtitle(page.draft, text) }
  )
  const published = await api<{ version: number }>(
    request,
    "POST",
    `/pages/${id}/publish`,
    { version: saved.version }
  )
  return { id, path, title: service.title, service, version: published.version }
}

// A custom page holding one rich-text section, like a legal page, for specs
// about the rich-text editor (service pages have no rich text). Pages are no
// longer created through the API, so the row goes straight into the E2E
// database as a draft; publishing goes through the API as usual.
export async function createRichTextPage(
  request: APIRequestContext,
  text: string,
  document: PageDocument = richTextDocument(text) as PageDocument
) {
  const path = `/e2e-${stamp()}`
  const [row] = (await runSql(
    "insert into pages (path, title, draft) values ($1, $2, $3::jsonb) returning id",
    [path, "E2E page", JSON.stringify(document)]
  )) as { id: string }[]
  const id = row!.id
  const published = await api<{ version: number }>(
    request,
    "POST",
    `/pages/${id}/publish`,
    { version: 1 }
  )
  return { id, path, version: published.version }
}

type Option = { id: string }

// A published article built from seeded taxonomy and media (parity untouched:
// a fresh slug per test).
export async function createPublishedArticle(
  request: APIRequestContext,
  { slug, title }: { slug: string; title: string }
) {
  const [{ items: cats }, { items: authors }, { items: media }] =
    await Promise.all([
      api<{ items: Option[] }>(request, "GET", "/categories"),
      api<{ items: Option[] }>(request, "GET", "/authors"),
      api<{ items: Option[] }>(request, "GET", "/media?type=image"),
    ])
  const { id } = await api<{ id: string }>(request, "POST", "/articles", {
    title,
    categoryId: cats[0]!.id,
    authorId: authors[0]!.id,
  })
  const draft = {
    title,
    slug,
    excerpt: "An E2E article.",
    cover: { mediaId: media[0]!.id },
    categoryId: cats[0]!.id,
    authorId: authors[0]!.id,
    featured: false,
    body: {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "text", text: `${title} body.` }],
        },
      ],
    },
  }
  const saved = await api<{ version: number }>(
    request,
    "PATCH",
    `/articles/${id}/draft`,
    { version: 1, draft }
  )
  const published = await api<{ version: number }>(
    request,
    "POST",
    `/articles/${id}/publish`,
    { version: saved.version }
  )
  return { id, version: published.version, draft }
}
