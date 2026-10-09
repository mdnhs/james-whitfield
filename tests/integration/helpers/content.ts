import { getDb } from "@/server/db/client"
import { media, pages } from "@/server/db/schema"

export async function insertMedia(
  overrides: Partial<typeof media.$inferInsert> = {}
) {
  const [row] = await getDb()
    .insert(media)
    .values({
      driver: "static",
      key: `/images/test-${crypto.randomUUID()}.png`,
      url: "/images/hero/hero-bg.png",
      filename: "test.png",
      mimeType: "image/png",
      sizeBytes: 1,
      width: 10,
      height: 10,
      ...overrides,
    })
    .returning()
  return row!
}

export const heroDocument = (mediaId: string, title = "Hello") => ({
  blocks: [
    {
      id: "custom-home",
      type: "hero.page" as const,
      anchor: "home",
      chapter: "Welcome",
      hidden: false,
      joinPrevious: false,
      data: {
        title,
        subtitle: "Sub",
        image: { mediaId },
        focal: null,
        tint: 0.3,
        mirror: false,
      },
    },
  ],
})

type Doc = (typeof pages.$inferInsert)["draft"]

export async function insertPage(values: {
  path: string
  systemKey?: string | null
  document: unknown
  published?: boolean
}) {
  const document = values.document as Doc
  const [row] = await getDb()
    .insert(pages)
    .values({
      path: values.path,
      title: "Test page",
      systemKey: values.systemKey ?? null,
      status: values.published ? "published" : "draft",
      draft: document,
      published: values.published ? document : null,
    })
    .returning()
  return row!
}
