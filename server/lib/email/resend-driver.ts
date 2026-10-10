import "server-only"

import { Resend } from "resend"

import { EmailError, type EmailDriver, type Envelope } from "./index"

type SendResult = {
  data: unknown
  error: { name?: string; message?: string } | null
}
export type ResendLike = {
  emails: {
    send(
      payload: Record<string, unknown>,
      options?: { idempotencyKey?: string }
    ): Promise<SendResult>
  }
}

// docs/brief.md §13: Resend 6 returns { data, error } instead of throwing.
export function createResendDriver(
  apiKey: string,
  client: ResendLike = new Resend(apiKey) as unknown as ResendLike
): EmailDriver {
  return {
    async send({ idempotencyKey, replyTo, ...message }: Envelope) {
      const { error } = await client.emails.send(
        { ...message, ...(replyTo ? { replyTo } : {}) },
        idempotencyKey ? { idempotencyKey } : undefined
      )
      if (error)
        throw new EmailError(
          error.name ?? "resend_error",
          error.message ?? "Resend refused the email"
        )
    },
  }
}
