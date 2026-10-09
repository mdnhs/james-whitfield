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

// The log driver keeps messages in memory for tests only: elsewhere (staging
// may use it) that would hold every live reset/invite token forever. Only
// development prints the body (so invite links work without a mail server);
// elsewhere just metadata is logged, since bodies carry those tokens.
const oneLine = (value: string) => value.replace(/[\r\n]+/g, " ")

const outbox: Envelope[] = []

const logDriver: EmailDriver = {
  async send(message) {
    const { NODE_ENV } = getEnv()
    if (NODE_ENV === "test") {
      outbox.push(message)
      return
    }
    const meta = `[email] to=${oneLine(message.to)} subject="${oneLine(message.subject)}"`
    console.info(NODE_ENV === "development" ? `${meta}\n${message.text}` : meta)
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
  // env validation guarantees SMTP_URL whenever the driver is "smtp".
  driver = env.EMAIL_DRIVER === "smtp" ? smtpDriver(env.SMTP_URL!) : logDriver
  return driver
}

export async function sendEmail(message: EmailMessage) {
  await getDriver().send({ ...message, from: getEnv().EMAIL_FROM })
}

export const readOutbox = () => [...outbox]
export const clearOutbox = () => {
  outbox.length = 0
}
