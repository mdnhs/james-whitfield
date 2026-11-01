// All on-screen copy, taken from the site's seed content
// (server/db/seed/fixtures). Edit here, then re-render.
export const CONTENT = {
  name: "Magda Kennedy",
  title: "Coach & Clinical Hypnotherapist",
  hook: {
    eyebrow: "A Different Kind of Change",
    // Words of the headline; muted words are drawn lighter, as on the site.
    headline: [
      { text: "Create", muted: false },
      { text: "meaningful", muted: true },
      { text: "change", muted: true },
      { text: "from", muted: false },
      { text: "the", muted: false },
      { text: "inside", muted: false },
      { text: "out.", muted: false },
    ],
    description:
      "Personalised hypnotherapy and coaching for people ready to think, lead and live differently.",
  },
  problem: {
    quote: ["When someone hits a ceiling,", "it is almost never for lack of effort."],
    follow:
      "For individuals, professionals and organisations who have reached the point where pushing harder has stopped working.",
  },
  meet: {
    eyebrow: "Meet your practitioner",
    place: "Merrion Square, Dublin",
    badges: [
      { title: "Qualified Hypnotherapist", subtitle: "Clinical evidence base", icon: "shield" },
      { title: "NLP Master Practitioner", subtitle: "Cognitive reframing", icon: "mind" },
      { title: "Applied Neuroplasticity", subtitle: "Sustainable rewiring", icon: "brain" },
      { title: "1-to-1 Confidential", subtitle: "Dublin clinic & global", icon: "lock" },
    ],
  },
  steps: {
    eyebrow: "How it works",
    title: "Four steps. No mysticism.",
    items: [
      {
        title: "Discovery Call",
        body: "A free, confidential conversation to understand your goals and see whether we are the right fit.",
        image: "images/hero.jpg",
      },
      {
        title: "Understand & Explore",
        body: "We map the pattern sitting beneath the challenge, rather than treating the surface symptom.",
        image: "images/step-2.jpg",
      },
      {
        title: "Reframe & Practice",
        body: "Guided sessions build new responses, rehearsed until they hold under real pressure.",
        image: "images/step-3.jpg",
      },
      {
        title: "Integrate",
        body: "Practical tools that make the change last well beyond our final session together.",
        image: "images/step-4.jpg",
      },
    ],
  },
  services: {
    eyebrow: "What I help with",
    title: "Six ways we can work together.",
    items: [
      { icon: "anxiety", title: "Anxiety & Stress", body: "A steadier baseline for everyday pressure." },
      { icon: "confidence", title: "Confidence & Self-Belief", body: "Quieten the inner critic." },
      { icon: "performance", title: "Performance & Leadership", body: "Clearer thinking, calmer decisions." },
      { icon: "habits", title: "Habits & Behaviour", body: "Break the loops that pull you back." },
      { icon: "sleep", title: "Sleep & Rest", body: "Retrain the mind to switch off." },
      { icon: "workplace", title: "Workplace Wellbeing", body: "Teams that handle pressure sustainably." },
    ],
    formats: "In person at Merrion Square, Dublin  ·  or securely online via Zoom",
  },
  cta: {
    headline: ["Ready for a different", "kind of change?"],
    sub: "Book a free, confidential 25-minute Discovery Call.",
    button: "Book a Discovery Call",
    footer: "Dublin & online across Ireland, the UK and the USA",
  },
}
