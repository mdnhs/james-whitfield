import "server-only"

import { parsePhoneNumberFromString } from "libphonenumber-js/min"

export function toE164(raw: string): string | null {
  const parsed = parsePhoneNumberFromString(raw, "IE")
  return parsed?.isValid() ? parsed.number : null
}
