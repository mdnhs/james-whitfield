import {
  BotIcon,
  Building2Icon,
  HeadingIcon,
  ListChecksIcon,
  SearchIcon,
  Share2Icon,
} from "lucide-react"

import type { FieldOverrides } from "@/admin/components/schema-form/to-fields"
import type { EditableGlobalKey } from "@/lib/content/global-access"

export const GLOBAL_FIELD_UI: Partial<
  Record<EditableGlobalKey, FieldOverrides>
> = {
  site: {
    logo: { label: "Logo" },
    logoLottie: {
      label: "Animated logo (Lottie)",
      description:
        "A Lottie JSON file, up to 2.5 MB. While the switch below is on, it replaces the logo everywhere on the site.",
    },
    logoLottieEnabled: {
      label: "Use the animated logo",
      description:
        "Off: the site shows the logo above. Needs an animated logo chosen.",
    },
    portrait: {
      label: "Portrait",
      description: "For search engines only; not shown.",
    },
    icon: {
      label: "Favicon",
      description:
        "Square PNG, JPEG or WebP, at least 512 × 512. SVG uploads are not accepted.",
    },
    social: { label: "Social profiles" },
  },
  contact: {
    "phone.e164": {
      label: "Phone for links",
      description: "International format, as tapped on phones.",
      placeholder: "+35312345678",
    },
    "hours.weekly": { label: "Opening hours" },
    "hours.weekly.$.days": {
      label: "Days",
      description: "1 = Monday … 7 = Sunday",
    },
    "hours.summary": { description: "How the site prints the hours." },
    // Phase 3 ruling: the Clinic block's own photo is the single source.
    "clinic.photo": {
      description:
        "Not shown: the Clinic block's photo is used. Sent to search engines.",
    },
  },
  footer: {
    social: {
      label: "Social media",
      description: "Icons under the footer text, in this order.",
    },
    "social.$.platform": {
      label: "Platform",
      options: [
        { value: "instagram", label: "Instagram" },
        { value: "facebook", label: "Facebook" },
        { value: "linkedin", label: "LinkedIn" },
        { value: "youtube", label: "YouTube" },
        { value: "x", label: "X (Twitter)" },
        { value: "tiktok", label: "TikTok" },
        { value: "whatsapp", label: "WhatsApp" },
      ],
    },
    "social.$.url": {
      label: "Profile address",
      description: "The full link, starting with https://",
    },
    "columns.$.source": {
      label: "Links",
      description: '"Navigation" appends the header links (auto sitemap).',
    },
  },
  contactForm: {
    planMessage: {
      description:
        '"{name}", "{price}" and "{unit}" come from the chosen plan.',
    },
  },
  microcopy: {
    readTime: { description: '"{minutes}" is replaced.' },
    showing: { description: '"{shown}" and "{total}" are replaced.' },
  },
  seo: {
    titleTemplate: {
      label: "Title template",
      section: "Titles & descriptions",
      sectionDescription: "Used for any page that leaves its own empty.",
      icon: HeadingIcon,
      description:
        '"%s" is replaced by the page title, for example "%s | Your name".',
    },
    defaultTitle: {
      label: "Default title",
      section: "Titles & descriptions",
      description: "Blank uses the site name.",
    },
    defaultDescription: {
      label: "Default description",
      section: "Titles & descriptions",
      widget: "textarea",
    },
    defaultOgImage: {
      label: "Default share image",
      section: "Social sharing",
      sectionDescription:
        "The card used when a page has no share image of its own.",
      icon: Share2Icon,
    },
    twitterHandle: {
      label: "X / Twitter handle",
      section: "Social sharing",
      placeholder: "@yourname",
    },
    robots: {
      label: "Search engines",
      section: "Indexing",
      sectionDescription:
        "Whether search engines list the site, and its main address.",
      icon: ListChecksIcon,
      options: [
        { value: "index", label: "List the site" },
        { value: "noindex", label: "Hide the whole site" },
      ],
    },
    preferredHost: {
      label: "Preferred address",
      section: "Indexing",
      description:
        "The other addresses (http, with or without www) send visitors here with a permanent redirect.",
      options: [
        { value: "off", label: "Off: keep all addresses working" },
        { value: "apex", label: "Without www" },
        { value: "www", label: "With www" },
      ],
    },
    verification: {
      label: "Search engine verification",
      icon: SearchIcon,
    },
    "verification.google": {
      label: "Google Search Console code",
      description: 'Only the code from the content="…" part of the tag.',
    },
    "verification.bing": { label: "Bing Webmaster code" },
    business: {
      label: "Business details (structured data)",
      icon: Building2Icon,
    },
    "business.type": {
      label: "Business type",
      widget: "select",
      options: [
        { value: "ProfessionalService", label: "Professional service" },
        { value: "LocalBusiness", label: "Local business" },
      ],
    },
    "business.priceRange": { label: "Price range", placeholder: "€€" },
    "business.sameAs": {
      label: "Other profiles",
      description: "Google profile, directories and similar pages.",
    },
    "business.areaServed": {
      label: "Areas served",
      description:
        "Towns, counties or countries you work with, for example Dublin. Blank uses Ireland, the UK and the US.",
    },
    "business.areaServed.$": { label: "Area" },
    "business.latitude": {
      label: "Latitude",
      placeholder: "53.3498",
      description:
        "Right-click your pin in Google Maps to copy it. Blank uses the clinic map.",
    },
    "business.longitude": { label: "Longitude", placeholder: "-6.2603" },
    "business.ratingValue": {
      label: "Google rating",
      placeholder: "4.9",
      description:
        "Only enter the rating shown on your Google profile; it must match real reviews.",
    },
    "business.reviewCount": { label: "Number of reviews", placeholder: "40" },
    llms: {
      label: "AI assistants (llms.txt)",
      description:
        "A plain-text summary of the site at /llms.txt that AI search tools read.",
      icon: BotIcon,
    },
    "llms.enabled": { label: "Publish /llms.txt" },
    "llms.summary": {
      label: "Summary",
      widget: "textarea",
      description:
        "Who you are and what you do, in a few sentences. Blank uses the default description.",
    },
  },
  notifications: {
    recipients: { label: "Recipients" },
    includeMessage: {
      label: "Include the message in emails",
      description: "Off by default: enquiries can hold health details.",
      warning: true,
    },
  },
  chat: {
    enabled: { label: "Show the chat on the site" },
    "bot.enabled": {
      label: "AI assistant answers first",
      description: "Needs an AI provider key. Chats go to that provider.",
      warning: true,
    },
    "bot.maxAiReplies": { label: "Assistant replies per chat" },
  },
  consent: {
    version: {
      description:
        "Raise this to ask every visitor again (for example after adding a new tool)",
    },
    reconsentMonths: {
      description: "Ask again after this many months (6 at most)",
    },
  },
  scripts: {
    "snippets.$.src": {
      label: "Script address",
      description:
        "https only, on an allowed host. Leave empty when you paste code below.",
    },
    "snippets.$.inline": { label: "Inline code", widget: "textarea" },
    "snippets.$.placement": {
      label: "When it loads",
      options: [
        { value: "head", label: "Early: as soon as the page is interactive" },
        { value: "body", label: "Late: when the browser is idle" },
      ],
    },
    "snippets.$.category": {
      label: "Needs consent for",
      options: [
        { value: "necessary", label: "Nothing (strictly necessary)" },
        { value: "analytics", label: "Analytics" },
        { value: "marketing", label: "Marketing" },
      ],
    },
    "snippets.$.routes": {
      label: "Pages",
      description:
        'Leave empty for every page. "/insights/*" matches every article.',
    },
    "snippets.$.enabled": { label: "Enabled" },
  },
}
