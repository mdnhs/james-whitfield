export type Testimonial = {
  quote: string
  name: string
  role: string
  avatar: string
}

const client = { name: "Verified Client", role: "Professional, Dublin" }

const QUOTES = {
  clarity:
    "“James helped me move from feeling overwhelmed by work to being able to lead with more clarity and presence.”",
  nervousSystem:
    "“The work was subtle, but the impact was immediate. I finally felt like I was working with my own nervous system instead of against it.”",
  pathForward:
    "“I arrived feeling stuck and left with a practical path forward. The sessions felt calm, thoughtful, and genuinely useful.”",
  confidence:
    "“Working with James has been an incredibly valuable experience. He took the time to understand my goals and gave me clear, practical guidance on how to strengthen my confidence and resilience. He’s been knowledgeable, thoughtful and a genuine pleasure to work with.”",
}

const avatar = (file: string) => `/images/testimonials/${file}.png`

export const TESTIMONIALS_HEADER = {
  eyebrow: "Testimonials",
  title: "What Clients Say",
}

// Two columns, in the design's order.
export const TESTIMONIAL_COLUMNS: Testimonial[][] = [
  [
    { ...client, quote: QUOTES.clarity, avatar: avatar("andrew-brown") },
    { ...client, quote: QUOTES.nervousSystem, avatar: avatar("ben-goldsmith") },
    { ...client, quote: QUOTES.clarity, avatar: avatar("dean-gardner") },
    { ...client, quote: QUOTES.pathForward, avatar: avatar("ted-white") },
  ],
  [
    { ...client, quote: QUOTES.pathForward, avatar: avatar("isabella-tree") },
    { ...client, quote: QUOTES.confidence, avatar: avatar("saif-hameed") },
    { ...client, quote: QUOTES.nervousSystem, avatar: avatar("ben-brown") },
  ],
]
