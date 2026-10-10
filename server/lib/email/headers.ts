import "server-only"

import * as z from "zod"

// Visitor-supplied text that ends up in a mail header (subject, reply-to)
// must never carry CR/LF: that would let it add headers (Bcc:) to the mail.
const CONTROL = /[\u0000-\u001f\u007f-\u009f\u2028\u2029]/g

export const headerText = (value: string) =>
  value.replace(CONTROL, " ").replace(/\s+/g, " ").trim()

const Address = z.email()

// One bare, well-formed address or nothing (no lists, no display names).
export function singleAddress(value: string): string | undefined {
  const trimmed = value.trim()
  return Address.safeParse(trimmed).success ? trimmed : undefined
}
