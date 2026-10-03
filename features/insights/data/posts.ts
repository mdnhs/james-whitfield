export type Post = {
  slug: string
  category: string
  // "\n" marks the design's line breaks.
  title: string
  excerpt: string
  image: string
  author: { name: string; avatar: string }
  date: { label: string; iso: string }
}

export const INSIGHTS_HEADER = {
  title: "Insights",
  subtitle:
    "Thoughtful perspectives on coaching and hypnotherapy as serious tools for meaningful change",
  cta: { label: "View all posts", href: "/insights" },
}

const img = (file: string) => `/images/insights/${file}.png`

export const POSTS: Post[] = [
  {
    slug: "big-agency-expertise",
    category: "Production",
    title: "Big agency expertise\nwithout the bureaucracy",
    excerpt: "Why our small, experienced team beats a big agency.",
    image: img("post-agency-expertise"),
    author: { name: "Lizi", avatar: img("author-lizi") },
    date: { label: "13th Aug, 2026", iso: "2026-08-13" },
  },
  {
    slug: "regular-listen-back",
    category: "Advice",
    title: "Why every business podcast\nneeds a regular “listen back”",
    excerpt: "Creating a great podcast doesn't end when you stop recording",
    image: img("post-listen-back"),
    author: { name: "Ben", avatar: img("author-ben") },
    date: { label: "28th Jul, 2026", iso: "2026-07-28" },
  },
  {
    slug: "host-without-being-an-expert",
    category: "Advice",
    title: "How to host a podcast\nwithout being a subject expert",
    excerpt: "The key role you play as a host is not to be a subject expert",
    image: img("post-host-podcast"),
    author: { name: "Rory", avatar: img("author-rory") },
    date: { label: "29th Jun, 2026", iso: "2026-06-29" },
  },
]
