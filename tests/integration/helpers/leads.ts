import { app } from "@/server/api/app"
import { getDb } from "@/server/db/client"
import { leads } from "@/server/db/schema"
import { issueStamp } from "@/server/modules/leads/stamp"

let ipCounter = 1
export const freshIp = () => `198.51.100.${ipCounter++ % 250}`

export function publicRequest(
  path: string,
  init: { method?: string; body?: unknown; ip?: string; cookie?: string } = {}
) {
  return app.request(`/api/v1/public${path}`, {
    method: init.method ?? "GET",
    headers: {
      "content-type": "application/json",
      "x-real-ip": init.ip ?? freshIp(),
      "user-agent": "vitest",
      ...(init.cookie ? { cookie: init.cookie } : {}),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  })
}

export const submission = (overrides: Record<string, unknown> = {}) => ({
  name: "Ann Example",
  email: `ann+${crypto.randomUUID().slice(0, 8)}@example.com`,
  phone: "087 123 4567",
  topic: "anxiety",
  format: "online",
  message: "SECRET-MESSAGE about my week",
  consent: true,
  website: "",
  stamp: issueStamp(Date.now() - 5_000),
  eventId: crypto.randomUUID(),
  sourcePath: "/contact",
  attribution: {
    referrer: "https://google.com/",
    utm: { utm_source: "google" },
  },
  ...overrides,
})

export async function insertLead(
  values: Partial<typeof leads.$inferInsert> = {}
) {
  const [row] = await getDb()
    .insert(leads)
    .values({
      name: "Ann",
      email: "ann@example.com",
      topicSlug: "anxiety",
      ...values,
    })
    .returning()
  return row!
}
