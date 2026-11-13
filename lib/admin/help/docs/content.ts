import type { HelpArticle } from "../types"

export const CONTENT_DOCS: readonly HelpArticle[] = [
  {
    slug: "insights-articles",
    title: "Writing Insights articles",
    group: "content",
    description: "Write, illustrate, publish and schedule blog articles.",
    lead: "Insights is your blog. Articles start as private drafts; nobody sees them until they are published.",
    permission: { page: ["read"] },
    keywords: [
      "blog",
      "article",
      "post",
      "write",
      "schedule",
      "cover image",
      "excerpt",
    ],
    sections: [
      {
        title: "Writing an article",
        blocks: [],
      },
      {
        title: "Starting an article",
        level: 3,
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Insights](/admin/insights) and press **New article**.",
              "Type a **Title** and pick a **Category**, then press **Create**.",
              "The editor opens. Write in the body where it says **Start writing…**.",
            ],
          },
          {
            type: "p",
            text: "The toolbar above the body has bold, italic, two heading sizes, bullet lists, quotes, links and images from the Media library. The reading time updates underneath as you write.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "The article saves as you type. Press `⌘S` (or `Ctrl S`) to save straight away.",
          },
        ],
      },
      {
        title: "Cover image, excerpt and details",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The panel beside the editor holds the article's details:",
          },
          {
            type: "list",
            items: [
              "**Cover image:** press **Choose cover image**. An article needs a cover image before it can be published.",
              "**Excerpt:** the short summary shown on the Insights page, up to 240 characters.",
              "**Slug:** the end of the article's address. Changing it on a published article adds a redirect from the old address.",
              "**Category** and **Author**.",
              "**Featured article:** only one article is featured at a time; featuring this one unfeatures the other.",
            ],
          },
        ],
      },
      {
        title: "Publishing, scheduling and unpublishing",
        blocks: [],
      },
      {
        title: "Publish and schedule",
        level: 3,
        blocks: [
          {
            type: "list",
            items: [
              "**Publish** puts it live now.",
              "**Schedule** picks a date and time (Dublin time) for it to go live on its own.",
            ],
          },
          {
            type: "callout",
            tone: "warning",
            text: "Editing a scheduled article moves it back to draft, so it needs to be scheduled again.",
          },
        ],
      },
      {
        title: "Unpublish",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Unpublish** takes it down. You choose what the old address does: show not found, redirect to Insights, or redirect to another article. You can also tick **Archive instead**.",
          },
        ],
      },
      {
        title: "History",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**History** lists earlier versions you can load back into the draft.",
          },
        ],
      },
      {
        title: "Review for authors",
        level: 3,
        blocks: [
          {
            type: "callout",
            tone: "note",
            text: "Authors cannot publish. They see **Submit for review** instead, and an editor publishes for them. The **Review requested** filter on the list shows these.",
          },
        ],
      },
      {
        title: "Finding and deleting articles",
        blocks: [
          {
            type: "p",
            text: "The list has a search box and filters for **Status** and **Category**. The switch on each row publishes or unpublishes quickly. **Delete** removes the article and its history for good after you confirm.",
          },
          {
            type: "p",
            text: "The search title and description are on the **SEO** tab of the editor.",
          },
        ],
      },
    ],
  },
  {
    slug: "insights-categories-authors",
    title: "Categories and authors",
    group: "content",
    description: "Organise articles by topic and show who wrote them.",
    lead: "Categories group your articles by topic. Authors are the names and photos shown on each article.",
    permission: { page: ["read"] },
    keywords: ["category", "author", "topic", "bio"],
    sections: [
      {
        title: "Managing categories",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Insights](/admin/insights) and choose the **Categories** tab.",
              "Press **New category**, or click a row to edit one.",
              "Fill in the **Name**, **Description** and, if you like, a **Related service**.",
              "Turn on **Visible on the site** and press **Save**. Changes go live when you save.",
            ],
          },
        ],
      },
      {
        title: "Managing authors",
        blocks: [
          {
            type: "p",
            text: "On the **Authors** tab, press **New author**. Add a **Name**, **Role title**, **Bio** and **Photo**, then **Save**.",
          },
          {
            type: "callout",
            tone: "note",
            text: "You cannot delete a category or author that articles still use. Move those articles first.",
          },
        ],
      },
    ],
  },
  {
    slug: "media",
    title: "The Media library",
    group: "content",
    description: "Upload images and PDFs, add alt text and set focal points.",
    lead: "Every image and PDF on the site lives in the Media library. Upload once, then pick it from any page or article.",
    permission: { media: ["read"] },
    keywords: [
      "image",
      "photo",
      "upload",
      "alt text",
      "focal point",
      "crop",
      "pdf",
    ],
    sections: [
      {
        title: "Uploading",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Media](/admin/media).",
              "Drag files onto **Drop files here or choose them**, or click it to pick files.",
              "Wait for each upload to finish. If it fails, press **Retry**.",
            ],
          },
          {
            type: "p",
            text: "You can upload JPEG, PNG, WebP, AVIF, SVG, ICO, PDF or Lottie files, up to 20 MB each.",
          },
        ],
      },
      {
        title: "Describing and cropping images",
        blocks: [],
      },
      {
        title: "Alt text",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "Alt text describes an image for people using screen readers, and helps search engines. Click a file to open its details:",
          },
          {
            type: "steps",
            items: [
              'Type a short description in **Alt text**, for example "Therapy room with two armchairs".',
              "If the image is only decoration, tick **Decorative (screen readers skip it)** instead.",
              "Press **Save details**.",
            ],
          },
          {
            type: "callout",
            tone: "tip",
            text: "Turn on **Missing alt text** above the grid to find every image that still needs it.",
          },
        ],
      },
      {
        title: "Focal point",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "The site crops images to fit different shapes on phones and computers. The focal point tells it which part must always stay in view, such as a face.",
          },
          {
            type: "steps",
            items: [
              "Open the image's details.",
              "Click the most important spot on the image. You can also nudge it with the arrow keys.",
              "Press **Save details**.",
            ],
          },
        ],
      },
      {
        title: "Replacing and deleting",
        blocks: [],
      },
      {
        title: "Replace a file",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Replace file (keeps every reference)** swaps in a new file of the same type. Every page using it updates.",
          },
        ],
      },
      {
        title: "See where a file is used",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Used on** lists where the file appears.",
          },
        ],
      },
      {
        title: "Delete a file",
        level: 3,
        blocks: [
          {
            type: "p",
            text: "**Delete file** removes it for good. A file that is still in use cannot be deleted; remove it from those pages first.",
          },
        ],
      },
    ],
  },
]
