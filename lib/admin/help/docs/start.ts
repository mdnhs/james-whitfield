import type { HelpArticle } from "../types"

export const START_DOCS: readonly HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    group: "start",
    description: "Sign in, set up two-factor and find your way around.",
    lead: "Everything you need for your first visit: how to sign in, how to keep your account safe and where things live in the admin.",
    keywords: ["sign in", "login", "log in", "layout", "sidebar", "search"],
    sections: [
      {
        title: "Signing in",
        blocks: [
          {
            type: "steps",
            items: [
              "Go to the admin address you were given and open the **Welcome back** screen.",
              "Type your **Email** and **Password**, then press **Sign in**.",
              "If you have two-factor turned on, type the 6-digit code from your authenticator app and press **Verify**.",
            ],
          },
        ],
      },
      {
        title: "Forgotten your password?",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Forgotten your password? Click **Forgot password?**, type your email and press **Send reset link**. The link in the email works for 24 hours. Choose a new password of at least 12 characters.",
          },
        ],
      },
      {
        title: "No sign-up page",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "note",
            text: "There is no sign-up page. New people join when an owner or admin invites them from Users & roles.",
          },
        ],
      },
      {
        title: "Two-factor authentication",
        blocks: [
          {
            type: "p",
            text: "Two-factor asks for a code from an app on your phone as well as your password, so a stolen password alone is not enough. It is optional, but strongly recommended for owners and admins.",
          },
        ],
      },
      {
        title: "Setting it up",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open your name in the top right and choose **Security** (or open [Account](/admin/account) and the **Security** tab).",
              "Press **Set up two-factor** and type your **Current password**, then **Continue**.",
              "Scan the QR code with an authenticator app (for example Google Authenticator or 1Password). Type the 6-digit code it shows and press **Verify**.",
              "Save your backup codes somewhere safe with **Copy codes**, then press **I've saved them**.",
            ],
          },
        ],
      },
      {
        title: "Backup codes",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "warning",
            text: "Each backup code works once and is shown only once. If you lose your phone, a backup code is how you get back in. At sign-in, choose **Use a backup code**.",
          },
        ],
      },
      {
        title: "Trusting a device",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "On your own computer you can tick **Trust this device for 30 days** so it does not ask for a code every time.",
          },
        ],
      },
      {
        title: "Finding your way around",
        blocks: [
        ],
      },
      {
        title: "Sidebar and dock",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**The sidebar** on the left lists the screens your role can open, in three groups: **Menu**, **Growth** and **General**. Sections with sub-pages, like **Website** and **Site settings**, open out when you click them.",
              "**The website card** under the menu has an **Open site** button that opens your live website in a new tab.",
              "**The dock** at the bottom of the sidebar holds **Users & roles**, **Activity log**, **Help** (this guide) and **Log out**.",
              "On a phone, the sidebar hides. Tap the menu button in the top bar to open it.",
            ],
          },
        ],
      },
      {
        title: "Top bar",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**The top bar** has the **Search** pill, the **Enquiries** shortcut, the notifications bell and your name. Your name opens **Account**, **Security**, the **Theme** choice and **Sign out**.",
          },
        ],
      },
      {
        title: "Search with ⌘K",
        blocks: [
          {
            type: "p",
            text: "Press `⌘K` on a Mac or `Ctrl K` on Windows, or click **Search** in the top bar. Start typing to jump to any screen, an article or a help page.",
          },
        ],
      },
      {
        title: "What you can search",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              '**Go to** lists the screens you can open. Words like "privacy" or "invite" find the right screen too.',
              "**Articles** finds your Insights articles by title.",
              "**Actions** switches the theme, opens the live site or signs you out.",
            ],
          },
        ],
      },
      {
        title: "Keyboard shortcuts",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "tip",
            text: "Use the arrow keys to move through the results and `Enter` to open one. `Esc` closes the search.",
          },
        ],
      },
      {
        title: "Where to go next",
        blocks: [
          {
            type: "list",
            items: [
              "[Saving and publishing](/admin/help/saving-and-publishing) explains why a change does not always show on the site straight away.",
              "[Roles and permissions](/admin/help/roles) explains why some people see fewer menu items.",
              "[Pages and the page builder](/admin/help/website-pages) is the place to start editing the website.",
            ],
          },
        ],
      },
    ],
  },
  {
    slug: "saving-and-publishing",
    title: "Saving and publishing",
    group: "start",
    description: "Drafts, publishing, history and what goes live when.",
    lead: "Some screens keep your changes as a private draft until you publish. Others go live the moment you save. This page tells you which is which.",
    keywords: ["draft", "publish", "live", "history", "restore", "autosave"],
    sections: [
      {
        title: "Drafts you publish",
        blocks: [
          {
            type: "p",
            text: "The website pages, service details pages and Insights articles save as you type. That save only updates the **draft**. Visitors keep seeing the last published version until you press **Publish**.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "**Saved** does not mean live. If the site has not changed, press **Publish**.",
          },
        ],
      },
      {
        title: "Status and save indicator",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "The status pill next to the page title says **Published** or **Draft**. **Unpublished** means there are draft changes that are not live yet.",
              "The save indicator shows **Saving…**, then **Saved**. **Unsaved changes** means it is about to save.",
            ],
          },
        ],
      },
      {
        title: "Saving straight away",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Press `⌘S` (or `Ctrl S`) to save straight away.",
          },
        ],
      },
      {
        title: "Changes that go live when you save",
        blocks: [
          {
            type: "p",
            text: "These screens have no draft step. A save changes the site straight away:",
          },
          {
            type: "list",
            items: [
              "**Header & footer**, and every page under **Site settings** except Appearance.",
              "Lists inside a page section, such as testimonials, FAQs, plans and services. The editor reminds you: **Shared: a saved change is live everywhere these are shown.**",
              "Insights categories and authors.",
              "SEO defaults, redirects and everything under **Marketing**.",
            ],
          },
        ],
      },
      {
        title: "Previewing before you publish",
        blocks: [
          {
            type: "p",
            text: "In the page builder, the **Preview** pane beside the form shows the draft and refreshes after each save. Switch between **Desktop**, **Tablet** and **Phone**, or open the preview in a new tab to see the full page.",
          },
        ],
      },
      {
        title: "History and restoring",
        blocks: [
          {
            type: "callout",
            tone: "note",
            text: "If someone else changed the same page while you were editing, you will see **Changed by someone else**. Choose **Review changes** to see theirs, or **Overwrite** to keep yours.",
          },
        ],
      },
      {
        title: "Pages and articles",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Pages and articles:** press **History** to see every published version. **Load into draft** brings an old version back into the draft. Check it, then press **Publish** again.",
          },
        ],
      },
      {
        title: "Settings, header and footer",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Settings, header and footer:** the history icon on each card lists the latest 20 saves. **Restore** puts one back and makes it live.",
          },
        ],
      },
      {
        title: "Throwing away a draft",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Throwing away a draft:** on a published page, **Discard** removes every unpublished change and goes back to the live version.",
          },
        ],
      },
    ],
  },
  {
    slug: "roles",
    title: "Roles and permissions",
    group: "start",
    description: "What each role can see and do.",
    lead: "Everyone who signs in has a role. The role decides which menu items they see and what they can change. The admin hides anything a role cannot open.",
    keywords: [
      "role",
      "permission",
      "owner",
      "admin",
      "editor",
      "intake",
      "access",
    ],
    sections: [
      {
        title: "The roles",
        blocks: [
          {
            type: "list",
            items: [
              "**Owner:** everything, including other owners and custom code.",
              "**Admin:** everything except custom code and managing owners.",
              "**Editor:** pages, articles, site content, media and SEO.",
              "**Author:** their own articles, without publishing. An editor publishes them.",
              "**Marketer:** SEO, redirects, tracking and the newsletter list. No enquiries.",
              "**Intake:** the enquiries inbox and live chat only.",
              "**Viewer:** can look at content but not change it.",
            ],
          },
          {
            type: "p",
            text: "Someone can hold more than one role. They get everything each role allows.",
          },
        ],
      },
      {
        title: "Why something is missing",
        blocks: [
          {
            type: "p",
            text: "If a menu item, button or help page is missing, your role does not include it. Read-only roles see a note such as **View only. Your role can read this page but not change or publish it.**",
          },
          {
            type: "p",
            text: "Ask an owner or admin to change your role in [Users & roles](/admin/users). The **Roles** tab there shows exactly what each role allows.",
          },
        ],
      },
      {
        title: "Enquiries are private",
        blocks: [
          {
            type: "callout",
            tone: "note",
            text: "Enquiries and chats can hold health information, so only owners, admins and intake staff can read them. Editors and marketers never see them.",
          },
        ],
      },
    ],
  },
  {
    slug: "dashboard",
    title: "The dashboard",
    group: "start",
    description: "Your overview: enquiries, articles, subscribers and to-dos.",
    lead: "The dashboard is the first screen after you sign in. It shows how the site is doing and what needs your attention.",
    keywords: ["home", "overview", "kpi", "next up"],
    sections: [
      {
        title: "What the dashboard shows",
        blocks: [
          {
            type: "list",
            items: [
              "**The figures along the top:** **New enquiries** in the last 30 days, **Published articles**, **Newsletter subscribers** and **SEO health**. Click SEO health to open the SEO overview.",
              "**Enquiries this week** compares this week with last week.",
              "**Next up** suggests what to do next, such as replying to a new enquiry, checking an article that is about to go live, inviting your team or turning on two-factor. When there is nothing left it says **You're all set**.",
              "**Team activity** lists the latest changes people made.",
              "**Content health** counts pages and articles that are complete, need work or are missing SEO text or alt text.",
            ],
          },
          { type: "open", href: "/admin", label: "Open the dashboard" },
        ],
      },
    ],
  },
]
