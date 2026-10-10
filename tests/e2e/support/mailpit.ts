import { expect } from "@playwright/test"

import { MAILPIT_URL } from "../fixtures/env"

type Summary = { ID: string; Created: string }
export type MailpitMessage = {
  Subject: string
  Text: string
  HTML: string
  To: { Address: string }[]
}

// Polls, because email is sent after the response (after()).
export async function latestEmail(
  query: string,
  since: Date
): Promise<MailpitMessage> {
  let found: MailpitMessage | undefined
  await expect
    .poll(
      async () => {
        const search = await fetch(
          `${MAILPIT_URL}/api/v1/search?query=${encodeURIComponent(query)}`
        )
        const { messages } = (await search.json()) as { messages: Summary[] }
        const fresh = messages.find((m) => new Date(m.Created) >= since)
        if (!fresh) return false
        found = (await (
          await fetch(`${MAILPIT_URL}/api/v1/message/${fresh.ID}`)
        ).json()) as MailpitMessage
        return true
      },
      { message: `email matching ${query}`, timeout: 15_000 }
    )
    .toBe(true)
  return found!
}
