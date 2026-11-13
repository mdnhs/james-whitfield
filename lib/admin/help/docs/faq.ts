import type { HelpArticle } from "../types"

export const FAQ_DOCS: readonly HelpArticle[] = [
  {
    slug: "troubleshooting",
    title: "Troubleshooting",
    group: "faq",
    description: "Quick answers to the most common questions.",
    lead: "Something not looking right? Start here.",
    keywords: ["faq", "problem", "not working", "help", "cropped", "missing"],
    sections: [
      {
        title: "I saved but the site didn't change",
        blocks: [
          {
            type: "p",
            text: "Pages and articles save to a private draft. Press **Publish** to make the change live. If the status pill says **Unpublished**, there are changes waiting.",
          },
          {
            type: "p",
            text: "Already published? Reload the live page. If you still see the old version, open it in a private window. See [Saving and publishing](/admin/help/saving-and-publishing).",
          },
        ],
      },
      {
        title: "I can't see a menu item",
        blocks: [
          {
            type: "p",
            text: "The admin only shows screens your role can open. Ask an owner or admin to check your role in Users & roles. See [Roles and permissions](/admin/help/roles).",
          },
        ],
      },
      {
        title: "An image looks cropped in the wrong place",
        blocks: [
          {
            type: "p",
            text: "Set the image's focal point in the Media library: open the image, click the part that must stay in view and press **Save details**. See [The Media library](/admin/help/media#focal-point).",
          },
        ],
      },
      {
        title: "I can't delete an image",
        blocks: [
          {
            type: "p",
            text: "A file that is still used on a page cannot be deleted. **Used on** in its details lists where; remove it there first, or use **Replace file** instead.",
          },
        ],
      },
      {
        title: "An old link shows a 'page not found' error",
        blocks: [
          {
            type: "p",
            text: "Add a redirect from the old address to the new one in SEO › Redirects. See [SEO](/admin/help/seo#redirects).",
          },
        ],
      },
      {
        title: "I lost my phone with the authenticator app",
        blocks: [
          {
            type: "p",
            text: "Sign in with one of your backup codes: on the code screen, choose **Use a backup code**. Then set two-factor up again on your new phone from Account › Security.",
          },
          {
            type: "callout",
            tone: "warning",
            text: "No backup codes left? Contact your website developer. They can reset two-factor for the owner account.",
          },
        ],
      },
      {
        title: "The page says someone else changed it",
        blocks: [
          {
            type: "p",
            text: "Two people edited the same page. Choose **Review changes** to load theirs, or **Overwrite** to keep yours. If you see **This page changed**, press **Reload latest**.",
          },
        ],
      },
      {
        title: "My article won't publish",
        blocks: [
          {
            type: "p",
            text: "Check it has a cover image and a category. If you are an author, you cannot publish; press **Submit for review** and an editor will publish it.",
          },
        ],
      },
      {
        title: "Enquiry emails aren't arriving",
        blocks: [
          {
            type: "p",
            text: "Check the recipients in Site settings › Notifications and look in your spam folder. New enquiries are always saved in Enquiries, even if an email fails.",
          },
        ],
      },
    ],
  },
]
