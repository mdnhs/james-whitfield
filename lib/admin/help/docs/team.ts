import type { HelpArticle } from "../types"

export const TEAM_DOCS: readonly HelpArticle[] = [
  {
    slug: "users",
    title: "Users and roles",
    group: "team",
    description: "Invite people, change their role and remove access.",
    lead: "**Users & roles** is where owners and admins manage who can sign in and what they can do.",
    permission: { user: ["list"] },
    keywords: ["team", "invite", "people", "remove", "ban", "view as"],
    sections: [
      {
        title: "Inviting someone",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Users & roles](/admin/users) from the dock at the bottom of the sidebar.",
              "Press **Invite someone**.",
              "Type their **Name** and **Email**, choose a **Role**, then press **Send invite**.",
              "They get an email with a link to set their password. It lasts seven days; use **Resend invite** if it runs out.",
            ],
          },
          {
            type: "p",
            text: "Not sure which role? See [Roles and permissions](/admin/help/roles). The **Roles** tab shows every permission side by side.",
          },
        ],
      },
      {
        title: "Changing what someone can do",
        blocks: [
          {
            type: "list",
            items: [
              "**Change roles** gives someone more or less access.",
              "**View as this person** shows the admin exactly as they see it, for up to an hour. You cannot change anything while viewing; press **Stop viewing** to return.",
              "**Sign out everywhere** ends all their sessions, for example after a lost laptop.",
            ],
          },
        ],
      },
      {
        title: "Removing access",
        blocks: [
          {
            type: "list",
            items: [
              "**Ban** blocks someone from signing in, for a set time or until you lift it with **Unban**.",
              "**Delete** removes the person for good.",
            ],
          },
          {
            type: "callout",
            tone: "note",
            text: "There must always be at least one owner. Only an owner can manage another owner, and nobody can change their own access.",
          },
        ],
      },
    ],
  },
  {
    slug: "activity-log",
    title: "Activity log",
    group: "team",
    description: "See who changed what, and when.",
    lead: "The **Activity log** records every important change: sign-ins, edits, publishing, settings, users and privacy requests.",
    permission: { audit: ["read"] },
    keywords: ["audit", "history", "who changed", "changes"],
    sections: [
      {
        title: "Finding a change",
        blocks: [
          {
            type: "steps",
            items: [
              "Open [Activity log](/admin/activity) from the dock.",
              "Narrow it down with **Action**, **Entity**, **Person**, **From** and **To**.",
              "Click **Changes** on a row to see what it looked like before and after.",
            ],
          },
          {
            type: "p",
            text: "**Export CSV** downloads the filtered list. Times are Irish time.",
          },
        ],
      },
    ],
  },
  {
    slug: "account",
    title: "Your account",
    group: "team",
    description: "Your name, password, two-factor, devices and theme.",
    lead: "**Account** holds your own details. Open it from your name in the top right.",
    keywords: [
      "profile",
      "password",
      "two-factor",
      "2fa",
      "sessions",
      "devices",
      "theme",
      "dark mode",
    ],
    sections: [
      {
        title: "Profile and theme",
        blocks: [
          {
            type: "p",
            text: "On the **Profile** tab, change your **Full name** and press **Save profile**. The **Appearance** card switches the admin between **Light**, **Dark** and **System**.",
          },
          { type: "open", href: "/admin/account", label: "Open your account" },
        ],
      },
      {
        title: "Password and two-factor",
        blocks: [
          {
            type: "list",
            items: [
              "**Change password:** type your **Current password** and a **New password**. This signs you out on your other devices.",
              "**Set up two-factor:** see [Getting started](/admin/help/getting-started#two-factor-authentication).",
              "**New backup codes** replaces your old codes if you have used or lost them.",
              "**Turn off** removes two-factor after you type your password.",
            ],
          },
        ],
      },
      {
        title: "Signed-in devices",
        blocks: [
          {
            type: "p",
            text: "The **Devices** tab lists everywhere you are signed in. Press **Sign out** next to one you do not recognise, or **Sign out other devices** to end them all.",
          },
          {
            type: "callout",
            tone: "tip",
            text: "Sessions last seven days. After that, you sign in again.",
          },
        ],
      },
    ],
  },
]
