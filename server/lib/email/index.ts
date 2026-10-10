import "server-only"

import nodemailer from "nodemailer"

import { getEnv } from "@/server/env"

import { createResendDriver } from "./resend-driver"

export type EmailMessage = {
  to: string | string[]
  subject: string
  html: string
  text: string
  replyTo?: string
  idempotencyKey?: string
}

export type Envelope = EmailMessage & { from: string }
export type EmailDriver = { send(message: Envelope): Promise<void> }

export class EmailError extends Error {
  constructor(
    readonly code: string,
    message: string
  ) {
    super(message)
    this.name = "EmailError"
  }
}

// The log driver keeps messages in memory for tests only: elsewhere (staging
// may use it) that would hold every live reset/invite token forever. Only
// development prints the body (so invite links work without a mail server);
// elsewhere just metadata is logged, since bodies carry those tokens.
const oneLine = (value: string | string[]) =>
  [value]
    .flat()
    .join(", ")
    .replace(/[\r\n]+/g, " ")

const outbox: Envelope[] = []

const logDriver: EmailDriver = {
  async send(message) {
    const { NODE_ENV } = getEnv()
    if (NODE_ENV === "test") {
      outbox.push(message)
      return
    }
    // Never log replyTo: it is the visitor's address.
    const key = message.idempotencyKey
      ? ` idempotencyKey=${oneLine(message.idempotencyKey)}`
      : ""
    const meta = `[email] to=${oneLine(message.to)} subject="${oneLine(message.subject)}"${key}`
    console.info(NODE_ENV === "development" ? `${meta}\n${message.text}` : meta)
  },
}

const smtpDriver = (url: string): EmailDriver => {
  const transport = nodemailer.createTransport(url)
  return {
    async send(message) {
      // nodemailer ignores unknown fields, but keep the key out of the mail.
      const { idempotencyKey, ...mail } = message
      void idempotencyKey
      try {
        await transport.sendMail(mail)
      } catch (error) {
        throw new EmailError(
          "smtp_error",
          error instanceof Error ? error.message : "SMTP send failed"
        )
      }
    },
  }
}

let driver: EmailDriver | undefined

function getDriver(): EmailDriver {
  if (driver) return driver
  const env = getEnv()
  // env validation guarantees SMTP_URL / RESEND_API_KEY for their drivers.
  driver =
    env.EMAIL_DRIVER === "smtp"
      ? smtpDriver(env.SMTP_URL!)
      : env.EMAIL_DRIVER === "resend"
        ? createResendDriver(env.RESEND_API_KEY!)
        : logDriver
  return driver
}

export async function sendEmail(message: EmailMessage) {
  await getDriver().send({ ...message, from: getEnv().EMAIL_FROM })
}

export const readOutbox = () => [...outbox]
export const clearOutbox = () => {
  outbox.length = 0
}
