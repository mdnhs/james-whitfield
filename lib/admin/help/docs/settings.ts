import type { HelpArticle } from "../types"

export const SETTINGS_DOCS: readonly HelpArticle[] = [
  {
    slug: "site-settings",
    title: "Site settings",
    group: "settings",
    description: "Name, contact details, forms, notifications and privacy.",
    lead: "**Site settings** holds the details used all over the site. Each page goes live as soon as you save it.",
    permission: { globals: ["read"] },
    keywords: [
      "identity",
      "logo",
      "phone",
      "address",
      "opening hours",
      "notifications",
      "retention",
    ],
    sections: [
      {
        title: "The settings pages",
        blocks: [
          {
            type: "p",
            text: "Open **Site settings** in the sidebar. It has one page for each area below. Pages your role cannot open are not listed.",
          },
        ],
      },
      {
        title: "Identity",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Identity](/admin/settings/identity) holds your name, professional title, logo, portrait, favicon and social profiles. Owners and admins only.",
          },
        ],
      },
      {
        title: "Contact & clinic",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Contact & clinic](/admin/settings/contact) holds your email, phone, address, opening hours and clinic details. Change your phone number here once and it updates everywhere on the site.",
          },
        ],
      },
      {
        title: "Forms & microcopy",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Forms & microcopy](/admin/settings/forms) has three tabs: **Contact form**, **Newsletter band** and **Microcopy**. They hold form labels, button text, success and error messages and other small wording.",
          },
        ],
      },
      {
        title: "Notifications",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "[Notifications](/admin/settings/notifications) sets who gets an email when a new enquiry arrives (up to 10 **Recipients**).",
              "**Include the message in emails** is off by default, so health details are not sent by email.",
              "The auto-reply sends the person who wrote a short confirmation.",
            ],
          },
        ],
      },
      {
        title: "Privacy",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "[Privacy](/admin/settings/privacy) sets how long enquiries, spam and chats are kept before they are deleted automatically, and whether newsletter sign-ups must confirm by email.",
          },
        ],
      },
      {
        title: "Saving and history",
        blocks: [
          {
            type: "p",
            text: "Press the save button at the bottom of each page. The history icon lists the latest 20 saves; **Restore** puts one back.",
          },
          {
            type: "callout",
            tone: "note",
            text: "If the form is greyed out, your role can read these settings but not change them.",
          },
        ],
      },
    ],
  },
  {
    slug: "appearance",
    title: "Appearance",
    group: "settings",
    description: "Colours, logo and the admin's own look.",
    lead: "**Appearance** changes the colours of your website and of the admin. Unlike other settings, it has a draft you publish.",
    permission: { appearance: ["read"] },
    keywords: [
      "theme",
      "colours",
      "colors",
      "brand",
      "logo",
      "favicon",
      "dark mode",
    ],
    sections: [
      {
        title: "Changing the colours",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Appearance](/admin/appearance).",
              "On the **Site** tab, pick a preset or set your **Brand** colours. The **Admin** tab changes the admin's own colours and corner radius.",
              "Changes save as a draft. Press **Preview on site** to see them.",
              "Press **Publish** to make them live.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "**Publish** stays blocked until the colours pass the contrast checks, so text stays readable for everyone.",
          },
        ],
      },
      {
        title: "Undoing",
        blocks: [
          {
            type: "list",
            items: [
              "**Discard draft** drops unpublished changes.",
              "**Reset to preset** starts again from a preset.",
              "**History** lists published versions; **Load into draft** brings one back.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "ai-assistant",
    title: "AI assistant",
    group: "settings",
    description: "Connect an AI provider for the admin helper and chat bot.",
    lead: "The AI assistant helps in the admin and can answer visitors in live chat. It reads the site but never changes it.",
    permission: { ai: ["manage"] },
    keywords: ["ai", "gemini", "claude", "openai", "api key", "chatbot", "bot"],
    sections: [
      {
        title: "Setting it up",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [AI assistant](/admin/settings/ai-assistant).",
              "Under **Provider**, choose **Google Gemini**, **Anthropic Claude** or **OpenAI-compatible**.",
              "Paste your **API key** from that provider. Choose a **Model**, or use **List models**.",
              "Turn on **Turn on the AI assistant** and press **Save**.",
              "Press **Test connection** to check it works.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Keep your API key private. Once saved, only its last four characters are shown. Changing the provider removes the saved key.",
          },
        ],
      },
      {
        title: "Who can use it",
        blocks: [
          {
            type: "list",
            items: [
              "**Who can use it** picks the roles that can use the assistant in the admin. Owners and admins always can.",
              "**Let the assistant read enquiry details** is off by default. Only the owner can turn it on, after confirming data-protection approval.",
              "**Extra instructions** guide its tone and answers.",
            ],
          },
          {
            type: "p",
            text: "The live chat bot uses the same provider and key. Turn it on in [Live chat settings](/admin/settings/chat).",
          },
        ],
      },
    ],
  },
]
