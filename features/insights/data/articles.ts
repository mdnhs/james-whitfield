export const INSIGHTS_HERO = {
  title: "Insights",
  subtitle:
    "Practical perspectives on stress, confidence and meaningful change.",
}

export const CATEGORIES = [
  "Anxiety & Stress",
  "Coaching",
  "Hypnotherapy",
  "Leadership",
  "Sleep",
] as const

export type Category = (typeof CATEGORIES)[number]

export type Article = {
  slug: string
  category: Category
  title: string
  excerpt: string
  image: string
  author: { name: string; avatar: string }
  date: { label: string; iso: string }
}

const img = (path: string) => `/images/${path}.png`

export const FEATURED_ARTICLE: Article & { readTime: string } = {
  slug: "why-pushing-harder-keeps-you-stuck",
  category: "Coaching",
  title:
    "Why the harder you push, the more stuck you feel and what to do instead.",
  excerpt:
    "High performers often treat stuckness as an effort problem. In most cases it is a safety problem. Here is how the nervous system quietly overrides willpower, and three gentle ways to work with it.",
  image: img("insights/post-listen-back"),
  author: { name: "Magda Kennedy", avatar: img("insights/avatar-featured") },
  date: { label: "2nd Sep, 2026", iso: "2026-09-02" },
  readTime: "8 min read",
}

// Newest first.
export const ARTICLES: Article[] = [
  {
    slug: "what-hypnosis-actually-feels-like",
    category: "Hypnotherapy",
    title: "What hypnosis actually feels like (it is not what you think)",
    excerpt: "Clearing up the five most common myths in under five minutes.",
    image: img("insights/post-agency-expertise"),
    author: { name: "Magda", avatar: img("insights/avatar-1") },
    date: { label: "24th Aug, 2026", iso: "2026-08-24" },
  },
  {
    slug: "ten-minute-wind-down-routine",
    category: "Sleep",
    title: "A ten-minute wind-down routine for a racing mind",
    excerpt:
      "Simple evening anchors that tell your nervous system it is safe to rest.",
    image: img("insights/post-host-podcast"),
    author: { name: "Magda", avatar: img("insights/avatar-2") },
    date: { label: "17th Aug, 2026", iso: "2026-08-17" },
  },
  {
    slug: "insight-versus-change",
    category: "Coaching",
    title: "The difference between insight and change",
    excerpt:
      "Understanding a pattern is step one. Here is what turns it into new behaviour.",
    image: img("how-it-works/step-2"),
    author: { name: "Magda", avatar: img("insights/avatar-3") },
    date: { label: "9th Aug, 2026", iso: "2026-08-09" },
  },
  {
    slug: "calm-is-a-skill",
    category: "Anxiety & Stress",
    title: "Why calm is a skill, not a personality trait",
    excerpt:
      "The trainable mechanics behind people who seem unflappable under pressure.",
    image: img("how-it-works/step-4"),
    author: { name: "Magda", avatar: img("insights/avatar-1") },
    date: { label: "1st Aug, 2026", iso: "2026-08-01" },
  },
  {
    slug: "decision-fatigue-always-on-leader",
    category: "Leadership",
    title: "Decision fatigue and the myth of the always-on leader",
    excerpt:
      "How senior teams can protect their best thinking for the decisions that matter.",
    image: img("insights/post-decision-fatigue"),
    author: { name: "Magda", avatar: img("insights/avatar-2") },
    date: { label: "22nd Jul, 2026", iso: "2026-07-22" },
  },
  {
    slug: "self-hypnosis-beginners-guide",
    category: "Hypnotherapy",
    title: "Self-hypnosis in practice: a beginner’s guide",
    excerpt:
      "A safe, structured five-step routine you can use at your desk or at home.",
    image: img("how-it-works/step-3"),
    author: { name: "Magda", avatar: img("insights/avatar-3") },
    date: { label: "14th Jul, 2026", iso: "2026-07-14" },
  },
]

export const PAGE_SIZE = 6

export const NEWSLETTER = {
  eyebrow: "Monthly letter",
  title: "One considered idea, once a month.",
  subtitle:
    "Practical notes on stress, confidence and change. No spam, unsubscribe anytime.",
  placeholder: "Your email address",
  submit: "Subscribe",
  success: "Thank you — the next letter is on its way to your inbox.",
}
