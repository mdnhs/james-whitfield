import type { DashboardDto } from "@/server/modules/dashboard/service"

// Fixed dashboard data for screenshots. Typed against the API's DTO so a
// change to the endpoint breaks this file, not a silent screenshot.
export const DASHBOARD_FIXTURE = {
  generatedAt: "2026-10-09T10:00:00.000Z",
  activeUsers: { value: 6, previous: 5 },
  signIns: {
    days: [
      { key: "2026-10-05", label: "Mon", current: 4, previous: 3 },
      { key: "2026-10-06", label: "Tue", current: 6, previous: 5 },
      { key: "2026-10-07", label: "Wed", current: 5, previous: 7 },
      { key: "2026-10-08", label: "Thu", current: 9, previous: 6 },
      { key: "2026-10-09", label: "Fri", current: 3, previous: 8 },
      { key: "2026-10-10", label: "Sat", current: 0, previous: 2 },
      { key: "2026-10-11", label: "Sun", current: 0, previous: 1 },
    ],
    current: 27,
    previous: 32,
  },
  security: { protected: 4, requiredMissing: 1, optionalMissing: 2, total: 7 },
  changes: { value: 18, previous: 12 },
  recentActivity: [
    {
      id: "a1",
      actorName: "Niamh Walsh",
      actorEmail: "niamh@example.com",
      action: "auth.sign_in",
      summary: "Signed in",
      createdAt: "2026-10-09T09:40:00.000Z",
    },
    {
      id: "a2",
      actorName: "Ciarán Doyle",
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
      id: "two-factor",
      title: "Two-factor is on",
      description:
        "A code from your phone keeps your account safe even if your password leaks.",
      cta: "Set up two-factor",
      href: "/admin/two-factor-setup",
      done: true,
    },
    {
      id: "invite",
      title: "Invite your team",
      description:
        "Give each person their own account and only the role they need.",
      cta: "Invite teammates",
      href: "/admin/users",
      done: false,
    },
  ],
} satisfies DashboardDto
