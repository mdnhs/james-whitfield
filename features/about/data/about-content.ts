import type { StatValue } from "@/lib/count"

const count = (value: number, suffix = "", decimals = 0): StatValue => ({
  kind: "count",
  value,
  decimals,
  prefix: "",
  suffix,
})

export const ABOUT_CONTENT = {
  eyebrow: "About Magda Kennedy",
  headline:
    "Real change starts with understanding where you are — and where you want to go.",
  quote:
    "“When someone hits a ceiling, it is almost never for lack of effort.”",
  body: [
    "James works with individuals, professionals and organisations who have reached the point where pushing harder has stopped working. His practice combines clinical hypnotherapy with evidence-informed coaching — no mysticism, no jargon, just a clear account of how change actually happens.",
    "Sessions run in person from Dublin and online with clients across Ireland, the UK and the USA.",
  ],
  stats: <{ value: StatValue; label: string }[]>[
    { value: count(10, "+"), label: "Years in practice" },
    { value: { kind: "text", text: "ICF / EMCC" }, label: "Accredited coach" },
    {
      value: { kind: "text", text: "Certified" },
      label: "Clinical hypnotherapy",
    },
  ],
  cta: { label: "Read the Full Story", href: "/about" },
}
