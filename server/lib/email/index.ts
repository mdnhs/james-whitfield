import "server-only"

import nodemailer from "nodemailer"

import { getEnv } from "@/server/env"

export type EmailMessage = {
  to: string
  subject: string
  html: string
  text: string
}

type Envelope = EmailMessage & { from: string }
type EmailDriver = { send(message: Envelope): Promise<void> }

// The log driver keeps messages in memory (tests read them) and prints them in
// development, so invite links are usable without a mail server.
const outbox: Envelope[] = []

const logDriver: EmailDriver = {
  async send(message) {
    outbox.push(message)
    if (getEnv().NODE_ENV !== "test") {
      console.info(
        `[email] to=${message.to} subject="${message.subject}"\n${message.text}`
      )
    }
  },
}

const smtpDriver = (url: string): EmailDriver => {
  const transport = nodemailer.createTransport(url)
  return {
    async send(message) {
      await transport.sendMail(message)
    },
  }
}

let driver: EmailDriver | undefined

function getDriver(): EmailDriver {
  if (driver) return driver
  const env = getEnv()
  driver =
    env.EMAIL_DRIVER === "smtp" && env.SMTP_URL
      ? smtpDriver(env.SMTP_URL)
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
