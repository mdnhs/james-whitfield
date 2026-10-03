import type { StaticImageData } from "next/image"

import heroBg from "@/public/images/hero/hero-bg.png"
import step2 from "@/public/images/how-it-works/step-2.png"
import step3 from "@/public/images/how-it-works/step-3.png"
import step4 from "@/public/images/how-it-works/step-4.png"

export type Step = {
  title: string
  description: string
  image: StaticImageData
  // Image crop box relative to the 381.75x216 media slot (from the design).
  crop: { left: string; top: string; width: string; height: string }
}

export const HOW_IT_WORKS = {
  title: "How It Works",
  subtitle:
    "A clear, considered path from first conversation to lasting change — four steps, no mysticism.",
  cta: { label: "Book a Discovery Call", href: "#contact" },
}

export const STEPS: Step[] = [
  {
    title: "Discovery Call",
    description:
      "A free, confidential conversation to understand your goals and see whether we are the right fit.",
    image: heroBg,
    crop: { left: "-11%", top: "-25.93%", width: "135.17%", height: "159.26%" },
  },
  {
    title: "Understand & Explore",
    description:
      "We map the pattern sitting beneath the challenge, rather than treating the surface symptom.",
    image: step2,
    crop: { left: "0.07%", top: "-8.8%", width: "100.07%", height: "117.59%" },
  },
  {
    title: "Reframe & Practice",
    description:
      "Guided sessions build new responses, rehearsed until they hold under real pressure.",
    image: step3,
    crop: { left: "0.13%", top: "0%", width: "99.8%", height: "117.59%" },
  },
  {
    title: "Integrate",
    description:
      "Practical tools that make the change last well beyond our final session together.",
    image: step4,
    crop: { left: "0%", top: "0%", width: "113.16%", height: "133.33%" },
  },
]
