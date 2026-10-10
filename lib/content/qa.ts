// docs/brief.md §4.6 and §2.3 Q3: content issues are listed in the admin's
// Content health panel, never fixed automatically. Isomorphic and pure.

export type QaRuleId =
  | "rebrand"
  | "placeholder-contact"
  | "placeholder-copy"
  | "online-reach"
  | "legal-unpublished"
export type QaSource = { label: string; href: string; value: unknown }
export type QaFinding = {
  rule: QaRuleId
  label: string
  href: string
  message: string
}

export const LEGAL_PATHS = ["/privacy", "/terms", "/disclaimer"] as const

const TEXT_RULES: { id: QaRuleId; message: string; pattern: RegExp }[] = [
  {
    id: "rebrand",
    message:
      "Mentions the previous practitioner (“James” or jameswhitfield.ie)",
    pattern: /\bJames\b|jameswhitfield/,
  },
  {
    id: "placeholder-contact",
    message: "Has placeholder contact details such as [email] or [phone]",
    pattern: /\[(?:email|phone|Dublin, Ireland)\]/i,
  },
  {
    id: "placeholder-copy",
    message: "Has placeholder copy that must be replaced before launch",
    pattern: /placeholder copy|is a placeholder|has not been reviewed/i,
  },
]
const WORLDWIDE = /\bworldwide\b/i
const THREE_COUNTRIES = /Ireland,\s*UK\s*(?:&|and)\s*(?:the\s*)?USA/i

export function strings(value: unknown, out: string[] = []): string[] {
  if (typeof value === "string") out.push(value)
  else if (Array.isArray(value)) for (const v of value) strings(v, out)
  else if (value && typeof value === "object")
    for (const v of Object.values(value)) strings(v, out)
  return out
}

export function scanContent(sources: readonly QaSource[]): QaFinding[] {
  const findings: QaFinding[] = []
  const worldwide: QaSource[] = []
  const threeCountries: QaSource[] = []
  for (const source of sources) {
    const text = strings(source.value).join("\n")
    for (const rule of TEXT_RULES) {
      if (rule.pattern.test(text)) {
        findings.push({
          rule: rule.id,
          label: source.label,
          href: source.href,
          message: rule.message,
        })
      }
    }
    if (WORLDWIDE.test(text)) worldwide.push(source)
    if (THREE_COUNTRIES.test(text)) threeCountries.push(source)
  }
  if (worldwide.length && threeCountries.length) {
    const labels = [
      ...new Set([...worldwide, ...threeCountries].map((s) => s.label)),
    ]
    findings.push({
      rule: "online-reach",
      label: labels.join(", "),
      href: worldwide[0]!.href,
      message:
        "Online sessions are “worldwide” in one place and “Ireland, UK & USA” in another",
    })
  }
  return findings
}

export function legalFinding(
  path: string,
  page: { id: string; title: string } | null
): QaFinding {
  return {
    rule: "legal-unpublished",
    label: page?.title ?? path,
    href: page ? `/admin/pages/${page.id}` : "/admin/pages",
    message: "Legal page is not published, so the footer link returns 404",
  }
}
