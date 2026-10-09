export const SERVICES_HERO = {
  title: "Services",
  subtitle: "Hypnotherapy and coaching shaped around where you are right now.",
}

export type Service = { icon: string; title: string; body: string }

const icon = (name: string) => `/images/services/icon-${name}.svg`

export const SERVICES = {
  eyebrow: "What I Help With",
  title: "Six ways we can work together.",
  intro:
    "Most clients arrive with one presenting issue and leave with a clearer understanding of the pattern underneath it. Each service follows the same four-step process, tailored to you.",
  // "Learn more" leads to the formats below until each service has its own page.
  more: { label: "Learn more  →", href: "#formats" },
  items: [
    {
      icon: icon("anxiety"),
      title: "Anxiety & Stress",
      body: "Calm an over-active stress response and build a steadier baseline for everyday pressure.",
    },
    {
      icon: icon("confidence"),
      title: "Confidence & Self-Belief",
      body: "Quieten the inner critic and replace old self-limiting stories with grounded confidence.",
    },
    {
      icon: icon("performance"),
      title: "Performance & Leadership",
      body: "Executive coaching for leaders who want clearer thinking and calmer decision-making.",
    },
    {
      icon: icon("habits"),
      title: "Habits & Behaviour Change",
      body: "Break the loops that keep pulling you back — from smoking and snacking to scrolling.",
    },
    {
      icon: icon("sleep"),
      title: "Sleep & Rest",
      body: "Retrain the mind to switch off, using hypnotherapy and simple evening routines.",
    },
    {
      icon: icon("workplace"),
      title: "Workplace Wellbeing",
      body: "Workshops and coaching programmes that help teams handle pressure sustainably.",
    },
  ] satisfies Service[],
}

export type Plan = {
  name: string
  price: string
  unit: string
  summary: string
  features: string[]
  // Opens the contact form with this plan pre-filled.
  cta: { label: string }
  // The highlighted plan: dark card, "Most chosen" tag, clay button.
  featured?: boolean
}

export const FORMATS = {
  eyebrow: "Formats & Investment",
  title: "Simple, transparent options.",
  subtitle:
    "Sessions take place in person at Merrion Square, Dublin, or securely online via Zoom.",
  plans: [
    {
      name: "Discovery Call",
      price: "Free",
      unit: "/ 25 minutes",
      summary:
        "A relaxed, confidential conversation to see whether we are the right fit.",
      features: ["Video or phone", "Explore your goals", "Zero obligation"],
      cta: { label: "Book a Free Call" },
    },
    {
      name: "Change Programme",
      price: "€840",
      unit: "/ 6 sessions",
      summary:
        "The full four-step process for lasting change — the option most clients choose.",
      features: [
        "Cognitive mapping session",
        "Bespoke hypnotherapy recordings",
        "Between-session check-ins",
        "Lifetime access to tools",
      ],
      cta: { label: "Start the Programme" },
      featured: true,
    },
    {
      name: "Single Session",
      price: "€160",
      unit: "/ 75 minutes",
      summary:
        "A focused session for a specific goal, or a top-up for returning clients.",
      features: [
        "In person or online",
        "Personal recording",
        "Follow-up email summary",
      ],
      cta: { label: "Book a Session" },
    },
  ] satisfies Plan[],
}
