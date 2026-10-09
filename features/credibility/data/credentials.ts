import type { IconName } from "@/lib/icons"

export type Credential = {
  title: string
  subtitle: string
  icon: IconName
}

export const CREDENTIALS: Credential[] = [
  {
    title: "Qualified Hypnotherapist",
    subtitle: "Clinical Evidence Base",
    icon: "shield",
  },
  {
    title: "NLP Master Practitioner",
    subtitle: "Cognitive Reframing",
    icon: "mind",
  },
  {
    title: "Applied Neuroplasticity",
    subtitle: "Sustainable Rewiring",
    icon: "brain",
  },
  {
    title: "1-to-1 Confidential",
    subtitle: "Dublin Clinic & Global",
    icon: "lock",
  },
]
