import { ContactFormGlobal, ContactGlobal } from "@/lib/content/globals"
import { getDb } from "@/server/db/client"
import { media, pages, services, settings } from "@/server/db/schema"

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

// The contact form's options: one service topic ("anxiety"), the formats
// "online" / "in-person", the extra topic "something-else", and the practice
// address that receives notifications when no recipients are set.
export async function insertServiceAndForm() {
  await getDb()
    .insert(services)
    .values({ slug: "anxiety", title: "Anxiety", body: "Body", icon: "mind" })
  await getDb()
    .insert(settings)
    .values([
      {
        key: "contactForm",
        value: ContactFormGlobal.parse({
          formats: ["Online", "In person"],
          extraTopics: ["Something else"],
          consent: "I agree to the privacy notice.",
        }),
      },
      {
        key: "contact",
        value: ContactGlobal.parse({ email: "practice@example.com" }),
      },
    ])
}
