import "server-only"

import { hasPermission, parseRoles } from "@/lib/auth/permissions"
import { roleRequiresTwoFactor } from "@/lib/auth/two-factor-policy"
import type { Actor } from "@/server/auth/actor"

import * as repo from "./repo"
import { weekWindow } from "./week"

export type DashboardDto = {
  generatedAt: string
  activeUsers: { value: number; previous: number }
  signIns: {
    days: { key: string; label: string; current: number; previous: number }[]
    current: number
    previous: number
  }
  security: {
    protected: number
    requiredMissing: number
    optionalMissing: number
    total: number
  } | null
  changes: { value: number; previous: number } | null
  recentActivity:
    | {
        id: string
        actorName: string | null
        actorEmail: string | null
        action: string
        summary: string
        createdAt: string
      }[]
    | null
  nextUp: {
    id: "two-factor" | "invite"
    title: string
    description: string
    cta: string
    href: string
    done: boolean
  }[]
}

const DAY = 86_400_000

function security(
  accounts: { role: string | null; twoFactorEnabled: boolean | null }[]
) {
  let protectedCount = 0
  let requiredMissing = 0
  let optionalMissing = 0
  for (const account of accounts) {
    if (account.twoFactorEnabled) protectedCount += 1
    else if (roleRequiresTwoFactor(parseRoles(account.role)))
      requiredMissing += 1
    else optionalMissing += 1
  }
  return {
    protected: protectedCount,
    requiredMissing,
    optionalMissing,
    total: accounts.length,
  }
}

// Only roles the two-factor policy covers are told it is required; for
// everyone else it is a recommendation.
function twoFactorStep(actor: Actor): DashboardDto["nextUp"][number] {
  const required = roleRequiresTwoFactor(actor.roles)
  return {
    id: "two-factor",
    title: actor.twoFactorEnabled ? "Two-factor is on" : "Turn on two-factor",
    description: required
      ? "Required for your role. A code from your phone keeps your account safe even if your password leaks."
      : "Recommended. A code from your phone keeps your account safe even if your password leaks.",
    cta: "Set up two-factor",
    href: "/admin/two-factor-setup",
    done: actor.twoFactorEnabled,
  }
}

// Dashboard v1 (docs/plan.md Phase 2, item 7): only data that exists before
// the content phases. Every widget respects RBAC: people and audit details
// need user.list / audit.read; everyone else gets aggregates.
export async function getDashboard(
  actor: Actor,
  now: Date = new Date()
): Promise<DashboardDto> {
  const week = weekWindow(now)
  const canAudit = hasPermission(actor.roles, { audit: ["read"] })
  const canListUsers = hasPermission(actor.roles, { user: ["list"] })
  const canInvite = hasPermission(actor.roles, { user: ["create"] })
  const monthAgo = new Date(now.getTime() - 30 * DAY)
  const twoMonthsAgo = new Date(now.getTime() - 60 * DAY)

  const [
    byDay,
    active,
    activeBefore,
    accounts,
    changes,
    changesBefore,
    recent,
  ] = await Promise.all([
    repo.signInsByDay(week.previousStart, week.end),
    repo.distinctSignedIn(monthAgo, now),
    repo.distinctSignedIn(twoMonthsAgo, monthAgo),
    canListUsers || canInvite ? repo.activeAccounts(now) : null,
    canAudit ? repo.changeCount(week.start, week.end) : null,
    canAudit ? repo.changeCount(week.previousStart, week.start) : null,
    canAudit ? repo.recentAudit(8) : null,
  ])

  const counts = new Map(byDay.map((row) => [row.day, row.count]))
  const days = week.days.map((day, index) => ({
    key: day.key,
    label: day.label,
    current: counts.get(day.key) ?? 0,
    previous: counts.get(week.previousDays[index]!.key) ?? 0,
  }))
  const sum = (key: "current" | "previous") =>
    days.reduce((total, day) => total + day[key], 0)

  const nextUp: DashboardDto["nextUp"] = [twoFactorStep(actor)]
  if (canInvite) {
    nextUp.push({
      id: "invite",
      title: "Invite your team",
      description:
        "Give each person their own account and only the role they need.",
      cta: "Invite teammates",
      href: "/admin/users",
      done: (accounts?.length ?? 0) > 1,
    })
  }

  return {
    generatedAt: now.toISOString(),
    activeUsers: { value: active, previous: activeBefore },
    signIns: { days, current: sum("current"), previous: sum("previous") },
    security: canListUsers && accounts ? security(accounts) : null,
    changes:
      changes === null || changesBefore === null
        ? null
        : { value: changes, previous: changesBefore },
    recentActivity:
      recent?.map((row) => ({
        ...row,
        createdAt: row.createdAt.toISOString(),
      })) ?? null,
    nextUp,
  }
}
