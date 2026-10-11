// admin/modules/ai/starters.ts
import {
  ChartColumnIcon,
  FileTextIcon,
  HeadingIcon,
  HeartHandshakeIcon,
  InboxIcon,
  MessageSquareTextIcon,
  NotebookPenIcon,
  SearchCheckIcon,
  type LucideIcon,
} from "lucide-react"

import type { AssistantScreen } from "./route-context"

// Ruling R17: a card fills the composer and focuses it; it never sends. The
// generic set leaves two prompts for the person to finish. The editor sets
// say "this page" / "this article": the server names it for the model.
export type Starter = { icon: LucideIcon; title: string; description: string }

const DEFAULT: Starter[] = [
  {
    icon: FileTextIcon,
    title: "Write a meta description for…",
    description: "About 150 characters, ready to paste",
  },
  {
    icon: HeartHandshakeIcon,
    title: "Rewrite this paragraph warmer: …",
    description: "Paste a paragraph after the colon",
  },
  {
    icon: SearchCheckIcon,
    title: "Which pages need SEO work?",
    description: "Checks the SEO report for gaps",
  },
  {
    icon: InboxIcon,
    title: "Summarise this week's enquiries",
    description: "Counts by status and topic",
  },
]

export const STARTERS: Record<AssistantScreen, Starter[]> = {
  default: DEFAULT,
  page: [
    {
      icon: FileTextIcon,
      title: "Write a meta description for this page",
      description: "About 150 characters, from the page text",
    },
    {
      icon: HeadingIcon,
      title: "Suggest a clearer heading",
      description: "Three options in plain language",
    },
    {
      icon: SearchCheckIcon,
      title: "Check this page's SEO",
      description: "Title, description and what's missing",
    },
    {
      icon: HeartHandshakeIcon,
      title: "Rewrite the intro warmer",
      description: "Same facts, a kinder opening",
    },
  ],
  article: [
    {
      icon: FileTextIcon,
      title: "Write a meta description for this article",
      description: "About 150 characters, from the article",
    },
    {
      icon: HeadingIcon,
      title: "Suggest a clearer title",
      description: "Three options readers would search for",
    },
    {
      icon: SearchCheckIcon,
      title: "Check this article's SEO",
      description: "Title, description and excerpt",
    },
    {
      icon: NotebookPenIcon,
      title: "Write a two-sentence excerpt",
      description: "For the Insights list and sharing",
    },
  ],
  leads: [
    {
      icon: InboxIcon,
      title: "Summarise this week's enquiries",
      description: "Counts by status and topic",
    },
    {
      icon: ChartColumnIcon,
      title: "Which topics come up most this month?",
      description: "Enquiry topics, busiest first",
    },
    {
      icon: SearchCheckIcon,
      title: "How do enquiries compare with last month?",
      description: "Week by week, spam left out",
    },
    {
      icon: MessageSquareTextIcon,
      title: "Draft a warm reply template for new enquiries",
      description: "No names or details, ready to adapt",
    },
  ],
}
