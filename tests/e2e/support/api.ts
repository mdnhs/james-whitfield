import type { APIRequestContext } from "@playwright/test"

import { E2E_ORIGIN } from "../fixtures/env"

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

// A fresh custom page per test, so specs never touch seeded pages (parity).
export async function createPublishedPage(
  request: APIRequestContext,
  text: string,
  document: unknown = richTextDocument(text)
) {
  const path = `/e2e-${Date.now()}-${Math.floor(Math.random() * 1e4)}`
  const { id } = await api<{ id: string }>(request, "POST", "/pages", {
    path,
    title: "E2E page",
  })
  const page = await api<{ version: number }>(request, "GET", `/pages/${id}`)
  const saved = await api<{ version: number }>(
    request,
    "PATCH",
    `/pages/${id}/draft`,
    { version: page.version, document }
  )
  const published = await api<{ version: number }>(
    request,
    "POST",
    `/pages/${id}/publish`,
    { version: saved.version }
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
