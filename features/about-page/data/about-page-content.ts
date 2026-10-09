import type { StatValue } from "@/lib/count"
import type { IconName } from "@/lib/icons"

const count = (value: number, suffix = "", decimals = 0): StatValue => ({
  kind: "count",
  value,
  decimals,
  prefix: "",
  suffix,
})

export const ABOUT_HERO = {
  title: "About",
  subtitle: "The person, the practice and the principles behind every session.",
  image: "/images/hero/hero-bg.png",
  focal: null,
  tint: 0.32,
  mirror: false,
}

export const ABOUT_STORY = {
  eyebrow: "My Story",
  title: "From the boardroom to the therapy chair and why it matters for you.",
  paragraphs: [
    "Before training as a clinical hypnotherapist, I spent twelve years leading teams in financial services. I saw first-hand how capable people quietly burn out, second-guess themselves, and stay stuck in patterns they can describe perfectly but cannot shift.",
    "That curiosity led me to clinical hypnotherapy, NLP and applied neuroscience. Today my practice blends all three into a calm, structured process — no mysticism, no jargon, just a clear account of how change actually happens.",
  ],
  quote:
    "“You don’t need more willpower. You need a different relationship with the part of you that’s been protecting you.”",
  badge: {
    value: count(10, "+"),
    label: "Years helping people change from within",
  },
  role: "Clinical Hypnotherapist & Coach",
  photo: "/images/about/story.png",
}

export const ABOUT_STATS = [
  { value: count(10, "+"), label: "Years in clinical practice" },
  { value: count(800, "+"), label: "Clients supported 1-to-1" },
  { value: count(3), label: "Countries — Ireland, UK & USA" },
  { value: count(4.9, "/5", 1), label: "Average client rating" },
]

export const ABOUT_APPROACH = {
  eyebrow: "My Approach",
  title: "Three principles behind every session.",
  subtitle:
    "Whatever brings you here, the way we work together stays consistent calm, structured and grounded in evidence.",
  principles: [
    {
      icon: "evidence" as IconName,
      title: "Evidence over mysticism",
      body: "Every technique is grounded in clinical research on attention, memory and neuroplasticity. You will always understand what we are doing and why.",
    },
    {
      icon: "control" as IconName,
      title: "You stay in control",
      body: "Hypnosis is a state of focused attention, not sleep. You are aware, safe and in charge throughout — nothing happens without your consent.",
    },
    {
      icon: "real-life" as IconName,
      title: "Built for real life",
      body: "Sessions end with practical tools — self-hypnosis recordings, reframes and small daily practices — so progress holds outside the room.",
    },
  ],
}

export const ABOUT_CREDENTIALS = {
  eyebrow: "Training & Credentials",
  title: "Qualified, accredited and always learning.",
  subtitle:
    "Ongoing supervision and continuing professional development are part of every practising week.",
  cta: { label: "Book a Discovery Call  →", href: "/contact" },
  items: [
    {
      year: "2024",
      title: "Applied Neuroplasticity Practitioner",
      issuer: "Neuroscience Academy, London",
      url: null,
    },
    {
      year: "2021",
      title: "ICF Professional Certified Coach (PCC)",
      issuer: "International Coaching Federation",
      url: null,
    },
    {
      year: "2019",
      title: "EMCC Senior Practitioner Accreditation",
      issuer: "European Mentoring & Coaching Council",
      url: null,
    },
    {
      year: "2017",
      title: "NLP Master Practitioner",
      issuer: "Society of NLP, Dublin",
      url: null,
    },
    {
      year: "2015",
      title: "Diploma in Clinical Hypnotherapy",
      issuer: "Irish Institute of Hypnotherapy",
      url: null,
    },
  ],
}

export const ABOUT_CTA = {
  eyebrow: "Your Next Step",
  title: "Ready when you are. It starts with one conversation.",
  bullets: ["Free 25-minute call", "No obligation", "In person or online"],
  cta: { label: "Book a Discovery Call →", href: "/contact" },
  image: "/images/enterprise/enterprise-bg.png",
  tint: 0.9,
}
