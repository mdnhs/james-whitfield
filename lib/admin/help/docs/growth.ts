import type { HelpArticle } from "../types"

export const GROWTH_DOCS: readonly HelpArticle[] = [
  {
    slug: "seo",
    title: "SEO",
    group: "growth",
    description: "How search engines see the site, defaults and redirects.",
    lead: "The SEO screens help Google and other search engines understand your site, and make sure old links still work.",
    permission: { seo: ["read"] },
    keywords: [
      "search",
      "google",
      "meta",
      "redirect",
      "sitemap",
      "robots",
      "search console",
    ],
    sections: [
      {
        title: "The SEO overview",
        blocks: [
          { type: "open", href: "/admin/seo", label: "Open the SEO overview" },
        ],
      },
      {
        title: "SEO health",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**SEO health** shows how many checks pass and how many need work.",
          },
        ],
      },
      {
        title: "Alt text",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Alt text** counts how many images are described. **Find images without alt text** takes you to the Media library, filtered.",
          },
        ],
      },
      {
        title: "Issues",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Issues** lists problems page by page. Press **Fix** to open the page that needs it.",
          },
        ],
      },
      {
        title: "Defaults",
        blocks: [
          {
            type: "p",
            text: "[Defaults](/admin/seo/defaults) holds the settings every page falls back on: the title pattern, the default description and sharing image, and the verification codes for Google Search Console and Bing.",
          },
        ],
      },
      {
        title: "What crawlers see",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The **What crawlers see** card shows your robots.txt and the addresses in your sitemap, exactly as search engines read them.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Leave robots set to index unless you want the whole site hidden from search engines.",
          },
        ],
      },
      {
        title: "Redirects",
        blocks: [
          {
            type: "p",
            text: "A redirect sends visitors from an old address to a new one. When you rename an article or move a page, the admin adds one for you, marked **Automatic**.",
          },
        ],
      },
      {
        title: "Add a redirect",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Redirects](/admin/seo/redirects) and press **New redirect**.",
              "In **From**, type the old address, for example /old-page.",
              "In **To**, type where it should go.",
              "Keep **Type** on 301 Permanent unless the move is temporary, then press **Save**.",
            ],
          },
        ],
      },
      {
        title: "Manage redirects",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Each row shows how often it was used. You can edit it, turn it off or delete it.",
          },
        ],
      },
    ],
  },
  {
    slug: "marketing",
    title: "Marketing and tracking",
    group: "growth",
    description:
      "Google Analytics, Meta Pixel, the cookie banner and custom code.",
    lead: "The Marketing screens connect your site to analytics and advertising tools. Nothing tracks a visitor until they agree in the cookie banner.",
    permission: { tracking: ["read"] },
    keywords: [
      "analytics",
      "ga4",
      "gtm",
      "google tag manager",
      "pixel",
      "meta",
      "cookies",
      "consent",
    ],
    sections: [
      {
        title: "Tracking",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Tracking](/admin/marketing).",
              "Paste the ID from your tool: **GTM container ID**, **GA4 measurement ID** or **Meta Pixel ID**.",
              "Turn on the matching switch, such as **Load Google Tag Manager**.",
              "Press **Save tracking**. It is live straight away.",
            ],
          },
        ],
      },
      {
        title: "Checking the status",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The **Status** panel tells you whether each tool is ready or what it still needs, for example turning on the consent banner.",
          },
        ],
      },
      {
        title: "The cookie banner",
        blocks: [
          {
            type: "p",
            text: "[Consent banner](/admin/marketing/consent) sets the wording of the banner visitors see. Every label must be filled in before you can turn it on. The **Preview** shows both the first screen and the customise screen.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "Changed your cookie policy? Raise the **Version** number to ask every visitor again.",
          },
        ],
      },
      {
        title: "Events and custom code",
        blocks: [],
      },
      {
        title: "Event catalogue",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Event catalogue](/admin/marketing/events) lists the events the site sends to your tools, such as a new lead or a booking click. It is for reference; there is nothing to change.",
          },
        ],
      },
      {
        title: "Custom code",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Custom code](/admin/marketing/code) adds extra scripts. Only owners can open it.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "Custom code runs on every visitor's page. Only paste code from a source you trust, and set **Needs consent for** so it waits for the cookie banner.",
          },
        ],
      },
    ],
  },
]
