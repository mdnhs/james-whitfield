import type { HelpArticle } from "../types"

const PAGE_READ = {
  page: ["read"],
} as const satisfies HelpArticle["permission"]

export const WEBSITE_DOCS: readonly HelpArticle[] = [
  {
    slug: "website-pages",
    title: "Pages and the page builder",
    group: "website",
    description: "Edit the text and images on each page of the site.",
    lead: "Each page of your website has its own screen under **Website**. You edit every section in place, check it in the preview, then publish.",
    permission: { ...PAGE_READ },
    keywords: [
      "page builder",
      "home page",
      "about",
      "sections",
      "edit page",
      "preview",
    ],
    sections: [
      {
        title: "Finding a page",
        blocks: [
          {
            type: "p",
            text: "Open **Website** in the sidebar. The pages are listed under it: **Home**, **About**, **Services**, **How it works**, **Contact** and **Insights**. The **Insights page** sections themselves sit on the **Page sections** tab of Insights.",
          },
          {
            type: "open",
            href: "/admin/website/home",
            label: "Open the Home page",
          },
        ],
      },
      {
        title: "Editing a section",
        blocks: [
          {
            type: "p",
            text: "A page is made of sections, such as the hero, the about intro or the testimonials. They are shown top to bottom in the same order as on the site. Their order is fixed, so you cannot lose or misplace one.",
          },
        ],
      },
      {
        title: "Text and images",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Scroll to the section you want. Each card shows its name, for example **Home hero** or **About intro**.",
              "Click into a field and type. Changes save on their own after a second.",
              "Watch the **Preview** pane beside the form. It refreshes after each save.",
              "When you are happy, press **Publish**. The toast **Published** confirms it is live.",
            ],
          },
        ],
      },
      {
        title: "Section settings",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "tip",
            text: "**Section settings** at the bottom of a card has **Journey rail label**. Leave it empty to keep the section out of the small progress rail on the page.",
          },
        ],
      },
      {
        title: "Lists inside a section",
        blocks: [
          {
            type: "p",
            text: "Some sections hold a list: testimonials, FAQs, plans, steps or services. Each row has its own controls.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "List items are shared and go live as soon as you save. They do not wait for **Publish**.",
          },
        ],
      },
      {
        title: "Reorder",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Drag handle:** drag a row to reorder it. With the keyboard, press `Space`, use the arrow keys, then `Space` again.",
          },
        ],
      },
      {
        title: "Show or hide",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Show switch:** hides or shows that item on the site without deleting it.",
          },
        ],
      },
      {
        title: "Edit and remove",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Edit:** opens a side panel. Change the fields and press **Save**.",
              "**Remove:** asks first, then deletes the item everywhere it is shown.",
            ],
          },
        ],
      },
      {
        title: "Add an item",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Add** (for example **Add FAQ**) creates a new item.",
          },
        ],
      },
      {
        title: "The save indicator",
        blocks: [
          {
            type: "list",
            items: [
              "**Unsaved changes:** you are typing; it saves in a moment.",
              "**Saving…** then **Saved:** your draft is safe.",
              "**Couldn't save:** check your connection and try `⌘S` again.",
              "**Changed by someone else:** another person edited the page. Press **Resolve** to choose whose changes to keep.",
            ],
          },
          {
            type: "p",
            text: "If you try to leave with unsaved work, the browser asks you to confirm.",
          },
        ],
      },
      {
        title: "Publishing, preview and history",
        blocks: [
          {
            type: "p",
            text: "See [Saving and publishing](/admin/help/saving-and-publishing) for the full picture.",
          },
        ],
      },
      {
        title: "Preview",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Preview** opens the draft version of the page in a new tab.",
          },
        ],
      },
      {
        title: "Publish",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Publish** makes the draft live. If something is missing, the problems are listed and the section is outlined so you can fix it.",
              "**Discard** (on a published page) throws away every unpublished change.",
            ],
          },
        ],
      },
      {
        title: "History and restore",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**History** lists each published version. **Load into draft** brings one back; publish again to make it live.",
          },
        ],
      },
      {
        title: "Search settings for a page",
        blocks: [
          {
            type: "p",
            text: "The **SEO** tab at the top of each page holds its search title and description. Press **Save SEO** to save them. **Change address** moves the page to a new web address; the old address redirects to the new one automatically.",
          },
        ],
      },
    ],
  },
  {
    slug: "services",
    title: "Services",
    group: "website",
    description: "Add, reorder, hide and edit services and their own pages.",
    lead: "Each service has a card in the services grid and its own details page. Both are edited from **Website › Services**.",
    permission: { ...PAGE_READ },
    keywords: [
      "service",
      "new service",
      "service page",
      "details",
      "plans",
      "pricing",
    ],
    sections: [
      {
        title: "The services list",
        blocks: [
          {
            type: "p",
            text: "Open [Services](/admin/website/services) and find the **Services grid** section. Each service is a row with a drag handle to reorder it, a switch to show or hide it, **Edit** and **Remove**.",
          },
        ],
      },
      {
        title: "Adding a service",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "In the **Services grid** section, press **Add service**.",
              "Fill in the **Card** tab: the name, short text and image that appear in the grid. The **Live preview** shows the card as you type.",
              "Press **Save**. This creates the service and its details page, and opens the **Details** tab.",
              "Fill in the details page sections, then press **Publish**.",
              "Finish with the **SEO** tab.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "The **Details** and **SEO** tabs stay greyed out until the card is saved once.",
          },
        ],
      },
      {
        title: "Removing a service",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "warning",
            text: "Removing a service also deletes its details page. If you only want to take it off the site for a while, use the show switch instead.",
          },
        ],
      },
      {
        title: "Editing a service",
        blocks: [
        ],
      },
      {
        title: "Card",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Card:** changes go live as soon as you press **Save**. Changing the slug changes the service's address; the old address redirects automatically.",
          },
        ],
      },
      {
        title: "Details",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Details:** the page builder for the service's own page, with sections such as **Benefits** and **FAQ (this service)**. These are drafts until you press **Publish**.",
          },
        ],
      },
      {
        title: "SEO",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**SEO:** the search title and description for the details page.",
          },
        ],
      },
      {
        title: "Plans and prices",
        blocks: [
          {
            type: "p",
            text: "The **Formats & investment** section on the Services page lists the session formats and prices. Edit them like any other list: **Edit** a row, or **Add plan**.",
          },
        ],
      },
    ],
  },
  {
    slug: "testimonials",
    title: "Testimonials and Google reviews",
    group: "website",
    description: "Add client testimonials and show your Google rating.",
    lead: "Testimonials are edited in the **Testimonials** section of the Home page. The same list also appears on the About page.",
    permission: { ...PAGE_READ },
    keywords: ["review", "google", "rating", "stars", "quote"],
    sections: [
      {
        title: "Adding a testimonial",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Home](/admin/website/home) and scroll to **Testimonials**.",
              "Press **Add testimonial**.",
              "Set **Source** to **Website testimonial** or **Google review**, then fill in the quote and name. Add a **Photo** if you have one.",
              "For a Google review, set the **Stars** and paste the **Link to the review on Google**.",
              "Make sure **Visible on the site** is on, then press **Save**. It is live straight away.",
            ],
          },
        ],
      },
      {
        title: "Your Google rating",
        blocks: [
          {
            type: "p",
            text: "Google reviews are typed in by hand; the site does not fetch them from Google. In the section's own fields:",
          },
          {
            type: "callout",
            tone: "note",
            text: "These section fields are part of the page draft, so press **Publish** after changing them.",
          },
        ],
      },
      {
        title: "Summary and links",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Google rating** and **Number of Google reviews** show the summary. Leave the rating empty to hide it.",
              "**Google profile link** powers the **See all on Google** button.",
              "**Write-a-review link** powers the **Write a review** button.",
            ],
          },
        ],
      },
      {
        title: "Which reviews show",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Show** chooses **All**, **Website testimonials only** or **Google reviews only**.",
          },
        ],
      },
    ],
  },
  {
    slug: "hero-background",
    title: "Home hero photo and depth",
    group: "website",
    description: "Change the big photo at the top of the Home page.",
    lead: "The **Home hero** section can show your own background photo. The admin builds a depth map from it in your browser, so the photo gently moves in 3D as visitors scroll.",
    permission: { ...PAGE_READ },
    keywords: [
      "hero",
      "background",
      "photo",
      "depth map",
      "parallax",
      "banner",
    ],
    sections: [
      {
        title: "Changing the photo",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Home](/admin/website/home) and find **Home hero**.",
              "In the **Background** group, use **Choose image** next to **Background photo**.",
              "Pick a photo from the library, or use **Upload new**.",
              "Wait while it says **Building depth map…**. When it finishes, the **Depth map** field fills in.",
              "Check the **Preview**, then press **Publish**.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "Leave the photo empty to keep the original photo with its full animation. A new photo gets depth, a slow camera drift and film grain, but the window light and breeze effects belong to the original photo only.",
          },
        ],
      },
      {
        title: "The depth map",
        blocks: [
        ],
      },
      {
        title: "What the depth map is",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "A depth map is a black-and-white copy of your photo: lighter areas are nearer, darker areas are further away. The site uses it to move the near and far parts at different speeds.",
          },
          {
            type: "list",
            items: [
              "It is made by a small AI model that runs inside your own browser, not by an online AI service.",
              "The first time, the browser downloads the model (about 25 MB). After that it is cached.",
              "The finished map is saved to the Media library as a decorative image ending in **-depth.png**.",
            ],
          },
        ],
      },
      {
        title: "If the depth map fails",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "If you see **Couldn't build the depth map**, the hero still shows your photo, just without depth. Try **Regenerate depth map** later, ideally in an up-to-date Chrome, Edge or Safari on a computer.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "Wide landscape photos with a clear subject in front of a background give the nicest effect.",
          },
        ],
      },
    ],
  },
  {
    slug: "legal-pages",
    title: "Legal pages",
    group: "website",
    description:
      "Privacy policy, terms and other pages linked from the footer.",
    lead: "**Legal pages** lists the pages linked from your footer, such as the privacy policy.",
    permission: { ...PAGE_READ },
    keywords: ["privacy policy", "terms", "cookies", "disclaimer"],
    sections: [
      {
        title: "Editing a legal page",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Legal pages](/admin/website/legal).",
              "Click the page title to open it in the page builder.",
              "Edit the text in the **Rich text** section.",
              "Press **Publish**.",
            ],
          },
          {
            type: "open",
            href: "/admin/website/legal",
            label: "Open Legal pages",
          },
        ],
      },
      {
        title: "Publishing and removing",
        blocks: [
          {
            type: "list",
            items: [
              "The switch on each row publishes or unpublishes the page straight away.",
              "**Delete** removes the page for good after you confirm. This can't be undone.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Unpublishing a page takes it off the site at once. Keep your privacy policy published.",
          },
        ],
      },
    ],
  },
  {
    slug: "header-footer",
    title: "Header and footer",
    group: "website",
    description: "The menu at the top, the footer links and social icons.",
    lead: "**Header & footer** controls the navigation menu and everything in the footer. Changes here are live as soon as you save.",
    permission: { globals: ["read"] },
    keywords: [
      "menu",
      "navigation",
      "footer",
      "social",
      "instagram",
      "facebook",
      "links",
    ],
    sections: [
      {
        title: "The navigation menu",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Header & footer](/admin/website/header-footer).",
              "In the **Navigation** card, edit the header links (up to 7) and the button link.",
              "Press **Save navigation**.",
            ],
          },
        ],
      },
      {
        title: "The footer and social icons",
        blocks: [
          {
            type: "steps",
            items: [
              "In the **Footer** card, edit the short text and the link columns (up to 4).",
              "Under **Social media**, add an icon: choose the **Platform** and paste the **Profile address**, starting with https://.",
              "Press **Save footer**.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Made a mistake? The history icon on each card lists the latest 20 saves. Press **Restore** to put one back.",
          },
        ],
      },
    ],
  },
]
