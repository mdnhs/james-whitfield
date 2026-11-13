import type { ReactNode } from "react"

// Turns contact details inside a chat message into tappable links: emails open
// the mail app, phone numbers dial, and a number labelled "WhatsApp" opens a
// WhatsApp chat. Hrefs are built from the matched digits/address only, so no
// message text ever lands in an href unescaped.

const EMAIL = String.raw`[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}`
// Spaces/tabs only, never a newline: a number must not run across lines.
const PHONE = String.raw`\+?\(?\d[\d \t().-]{6,}\d`
const TOKEN = new RegExp(`(${EMAIL})|(${PHONE})`, "g")

// Irish site: a national number (leading 0) becomes +353 for WhatsApp.
const COUNTRY = "353"
const MIN_DIGITS = 9
const MAX_DIGITS = 15

const linkClass =
  "underline underline-offset-2 decoration-current/50 hover:decoration-current"

function international(raw: string) {
  const digits = raw.replace(/\D/g, "")
  if (raw.trim().startsWith("+")) return digits
  if (digits.startsWith("00")) return digits.slice(2)
  if (digits.startsWith("0")) return COUNTRY + digits.slice(1)
  return digits
}

// "WhatsApp" earlier on the same line, within a short label distance.
function isWhatsApp(text: string, index: number) {
  const lineStart = text.lastIndexOf("\n", index - 1) + 1
  const before = text.slice(Math.max(lineStart, index - 40), index)
  return /whats\s*app/i.test(before)
}

export function linkify(text: string): ReactNode[] {
  const out: ReactNode[] = []
  let last = 0
  for (const match of text.matchAll(TOKEN)) {
    const [whole, email, phone] = match
    const start = match.index
    let href: string | null = null
    let label = whole
    let external = false

    if (email) {
      href = `mailto:${email}`
    } else if (phone) {
      // Trailing spaces/punctuation are not part of the number.
      label = phone.replace(/[\s.(-]+$/, "")
      const digits = label.replace(/\D/g, "")
      if (digits.length >= MIN_DIGITS && digits.length <= MAX_DIGITS) {
        if (isWhatsApp(text, start)) {
          href = `https://wa.me/${international(label)}`
          external = true
        } else {
          const plus = label.trim().startsWith("+") ? "+" : ""
          href = `tel:${plus}${digits}`
        }
      }
    }

    if (!href) continue
    if (start > last) out.push(text.slice(last, start))
    out.push(
      <a
        key={start}
        href={href}
        className={linkClass}
        {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      >
        {label}
      </a>
    )
    last = start + label.length
  }
  if (last < text.length) out.push(text.slice(last))
  return out
}
