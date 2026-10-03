export type Credential = {
  title: string
  subtitle: string
  icon: { src: string; width: number; height: number }
}

// Icon sizes match each SVG's root width/height from the design.
export const CREDENTIALS: Credential[] = [
  {
    title: "Qualified Hypnotherapist",
    subtitle: "Clinical Evidence Base",
    icon: { src: "/images/credibility/shield.svg", width: 14.0909, height: 17.6136 },
  },
  {
    title: "NLP Master Practitioner",
    subtitle: "Cognitive Reframing",
    icon: { src: "/images/credibility/mind.svg", width: 16.7433, height: 17.6136 },
  },
  {
    title: "Applied Neuroplasticity",
    subtitle: "Sustainable Rewiring",
    icon: { src: "/images/credibility/brain.svg", width: 15.8523, height: 15.8523 },
  },
  {
    title: "1-to-1 Confidential",
    subtitle: "Dublin Clinic & Global",
    icon: { src: "/images/credibility/lock.svg", width: 14.0909, height: 18.4943 },
  },
]
