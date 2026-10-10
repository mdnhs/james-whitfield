import type { DashboardDto } from "@/server/modules/dashboard/service"

// Fixed dashboard data for screenshots. Typed against the API's DTO so a
// change to the endpoint breaks this file, not a silent screenshot.
export const DASHBOARD_FIXTURE = {
  generatedAt: "2026-10-09T10:00:00.000Z",
  enquiries: { value: 12, previous: 9 },
  enquiriesWeek: {
    days: [
      { key: "2026-10-05", label: "Mon", current: 2, previous: 1 },
      { key: "2026-10-06", label: "Tue", current: 3, previous: 2 },
      { key: "2026-10-07", label: "Wed", current: 1, previous: 2 },
      { key: "2026-10-08", label: "Thu", current: 4, previous: 3 },
      { key: "2026-10-09", label: "Fri", current: 2, previous: 1 },
      { key: "2026-10-10", label: "Sat", current: 0, previous: 1 },
      { key: "2026-10-11", label: "Sun", current: 0, previous: 0 },
    ],
    current: 12,
    previous: 10,
  },
  articles: { published: 7, scheduled: 1 },
  subscribers: { confirmed: 148, newThisMonth: 11 },
  seoHealth: { score: 92, issues: 4 },
  contentHealth: {
    complete: 9,
    needsWork: 3,
    missing: 2,
    total: 14,
    findingsTotal: 3,
    findings: [
      {
        rule: "rebrand",
        label: "Page \u201cAbout\u201d",
        href: "/admin/pages/p-about",
        message:
          "Mentions the previous practitioner (\u201cJames\u201d or jameswhitfield.ie)",
      },
      {
        rule: "placeholder-contact",
        label: "Footer",
        href: "/admin/settings/footer",
        message: "Has placeholder contact details such as [email] or [phone]",
      },
      {
        rule: "legal-unpublished",
        label: "Privacy Policy",
        href: "/admin/pages/p-privacy",
        message: "Legal page is not published, so the footer link returns 404",
      },
    ],
  },
  recentActivity: [
    {
      id: "a1",
      actorName: "Niamh Walsh",
      actorEmail: "niamh@example.com",
      action: "article.publish",
      summary: "Published \u201cCalm is a skill\u201d",
      createdAt: "2026-10-09T09:40:00.000Z",
    },
    {
      id: "a2",
      actorName: "Ciar\u00e1n Doyle",
      actorEmail: "ciaran@example.com",
      action: "user.invite",
      summary: "Invited aoife@example.com as editor",
      createdAt: "2026-10-09T08:15:00.000Z",
    },
    {
      id: "a3",
      actorName: "Aoife Byrne",
      actorEmail: "aoife@example.com",
      action: "auth.sign_in",
      summary: "Signed in",
      createdAt: "2026-10-08T16:05:00.000Z",
    },
    {
      id: "a4",
      actorName: null,
      actorEmail: null,
      action: "user.bootstrap-owner",
      summary: "Created the first owner",
      createdAt: "2026-10-01T09:00:00.000Z",
    },
  ],
  nextUp: [
    {
      id: "enquiry",
      title: "Reply to Aoife",
      description:
        "Waiting since 6 Oct: the oldest enquiry nobody has contacted yet.",
      cta: "Open enquiry",
      href: "/admin/leads?lead=l-aoife",
      done: false,
    },
    {
      id: "two-factor",
      title: "Two-factor is on",
      description:
        "Strongly recommended for your role, which can change who has access. A code from your phone keeps your account safe even if your password leaks.",
      cta: "Open security settings",
      href: "/admin/account?tab=security",
      done: true,
    },
    {
      id: "invite",
      title: "Invite your team",
      description:
        "Give each person their own account and only the role they need.",
      cta: "Invite teammates",
      href: "/admin/users",
      done: true,
    },
  ],
} satisfies DashboardDto
