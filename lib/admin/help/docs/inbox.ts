import type { HelpArticle } from "../types"

export const INBOX_DOCS: readonly HelpArticle[] = [
  {
    slug: "enquiries",
    title: "Enquiries",
    group: "inbox",
    description: "Read and follow up messages from the contact form.",
    lead: "Every message sent through the contact form lands in **Enquiries**. Times are shown in Irish time.",
    permission: { lead: ["read"] },
    keywords: [
      "lead",
      "contact form",
      "inbox",
      "message",
      "spam",
      "gdpr",
      "erase",
    ],
    sections: [
      {
        title: "Reading an enquiry",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Enquiries](/admin/leads). New messages are counted on the menu item.",
              "Click an enquiry to open it. You see the contact details, the message, the consent given and where it came from.",
              "Use **Email** or **Call** to get in touch.",
            ],
          },
        ],
      },
      {
        title: "Keeping track",
        blocks: [
          {
            type: "list",
            items: [
              "**Board** shows four columns: **New**, **Contacted**, **Booked** and **Closed**. Drag a card to move it on.",
              "**Table** lists every enquiry with a status filter.",
              "Inside an enquiry, set the **Status** and an **Assignee**, and use **Add note** to leave notes for the team.",
            ],
          },
        ],
      },
      {
        title: "Spam",
        blocks: [
          {
            type: "p",
            text: "Suspicious messages go to the **Spam** tab with a reason. If a real person was caught, open it and press **Not spam**.",
          },
        ],
      },
      {
        title: "Exports and privacy requests",
        blocks: [
          {
            type: "list",
            items: [
              "**Export CSV** downloads the enquiries you are looking at.",
              "**Privacy request** finds everything held for one email address. **Download data** gives a copy; **Erase all data** deletes it after you type the email to confirm.",
              "**Erase** inside one enquiry deletes just that one, permanently.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Erasing cannot be undone. Only do it when someone asks for their data to be deleted.",
          },
          {
            type: "p",
            text: "Old enquiries are deleted automatically after the time set in [Privacy](/admin/settings/privacy).",
          },
        ],
      },
    ],
  },
  {
    slug: "live-chat",
    title: "Live chat",
    group: "inbox",
    description: "Answer visitors, work with the AI assistant, handle crises.",
    lead: "The chat bubble on your site lets visitors message you. An optional AI assistant can answer first and pass the chat to a person when needed.",
    permission: { chat: ["read"] },
    keywords: ["chat", "inbox", "reply", "bot", "online", "offline", "crisis"],
    sections: [
      {
        title: "The chat inbox",
        blocks: [
          {
            type: "p",
            text: "Open [Live chat](/admin/chat). The **Open** tab lists chats in progress; **Closed** lists finished ones. Badges show **Needs a person**, **AI**, or who the chat is assigned to.",
          },
          {
            type: "steps",
            items: [
              "Click a chat to read it.",
              "Type in the reply box. `Enter` sends, `Shift Enter` starts a new line.",
              "Use **Assign to me** so the team knows you are on it.",
              "Press **Close** when the conversation is over.",
            ],
          },
        ],
      },
      {
        title: "Being online",
        blocks: [
          {
            type: "p",
            text: "There is no online switch. While you have the chat inbox open, you count as online, and for two minutes after your last activity. When nobody is online, visitors see the offline note and can leave their email.",
          },
          {
            type: "callout",
            tone: "note",
            text: "If a visitor waits more than five minutes for a reply, the team gets an email. Chats with no messages for 24 hours close on their own.",
          },
        ],
      },
      {
        title: "Working with the AI assistant",
        blocks: [
          {
            type: "list",
            items: [
              "When the assistant is on, it answers first using what is on your website.",
              "It hands over to a person when a visitor shares health details or asks for a human. The chat is marked **Needs a person** and the team gets an email.",
              "Press **Take over** to answer yourself. Sending a reply also takes over. **Hand back to AI** lets it carry on.",
            ],
          },
        ],
      },
      {
        title: "Crisis messages",
        blocks: [
          {
            type: "callout",
            tone: "warning",
            text: "If a visitor writes something that suggests they may harm themselves, the site immediately shows them emergency numbers (112 or 999, and Samaritans on 116 123). This message is fixed; the AI never writes it. The chat is marked **Needs a person** and the team gets an email asking them to look at it first.",
          },
          {
            type: "p",
            text: "This check runs on every message, whether the AI assistant is on or not. Please open these chats first.",
          },
        ],
      },
      {
        title: "Live chat settings",
        blocks: [
          {
            type: "p",
            text: "Owners and admins set up the chat in [Site settings › Live chat](/admin/settings/chat):",
          },
          {
            type: "list",
            items: [
              "**Show the chat on the site** turns the bubble on or off.",
              "The welcome message and the offline note visitors see.",
              "**AI assistant answers first** lets the assistant reply before a person. It needs an AI provider set up in [AI assistant](/admin/settings/ai-assistant).",
              "**Assistant replies per chat** limits how long the assistant keeps going before passing to the team.",
            ],
          },
          {
            type: "p",
            text: "Press the save button at the bottom to make changes live. Old chats are deleted after the time set in Privacy.",
          },
        ],
      },
    ],
  },
  {
    slug: "newsletter",
    title: "Newsletter",
    group: "inbox",
    description: "See who signed up, export the list, remove subscribers.",
    lead: "**Newsletter** lists the people who signed up for your monthly letter through the newsletter band on the site.",
    permission: { newsletter: ["read"] },
    keywords: [
      "subscribers",
      "email list",
      "mailing list",
      "unsubscribe",
      "double opt-in",
    ],
    sections: [
      {
        title: "Subscribers",
        blocks: [
          {
            type: "list",
            items: [
              "Open [Newsletter](/admin/newsletter). The tabs show **Confirmed**, **Pending**, **Unsubscribed** and **All**.",
              "**Pending** people signed up but have not clicked the link in their confirmation email yet.",
              "**Export CSV** downloads confirmed subscribers (or everyone, on the **All** tab) to import into your email tool.",
              "The bin icon removes a subscriber for good.",
            ],
          },
        ],
      },
      {
        title: "Confirmation and unsubscribing",
        blocks: [
          {
            type: "p",
            text: "With double opt-in on (the default, in [Privacy](/admin/settings/privacy)), each new subscriber gets an email with a link to confirm. The link works once and lasts seven days. The site then shows a confirmation page.",
          },
          {
            type: "p",
            text: "The unsubscribe link in emails opens a page where the person confirms they want to leave. They then move to **Unsubscribed**.",
          },
        ],
      },
      {
        title: "Changing the newsletter band",
        blocks: [
          {
            type: "p",
            text: "The newsletter sign-up box on the site is the **Newsletter band** section. Its shared wording, button text, image and confirmation email live in [Forms & microcopy](/admin/settings/forms), on the **Newsletter band** tab. A band on a single page can override the heading and text.",
          },
        ],
      },
    ],
  },
]
