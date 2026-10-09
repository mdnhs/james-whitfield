import type { Metadata } from "next"
import { Suspense } from "react"

import { BrandMark } from "@/admin/components/brand-mark"
import { SignOutButton } from "@/admin/modules/auth/sign-out-button"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

// Placeholder until the Phase 2 shell and dashboard.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("")

async function Welcome() {
  const actor = await requireActor()
  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-4">
      <header className="flex items-center justify-between gap-4 rounded-[22px] bg-sidebar px-5 py-4">
        <BrandMark />
        <div className="flex items-center gap-3">
          <span
            aria-hidden
            className="flex size-10 items-center justify-center rounded-full bg-primary text-sm font-semibold text-primary-foreground"
          >
            {initials(actor.name)}
          </span>
          <span className="hidden flex-col sm:flex">
            <span className="text-sm font-semibold">{actor.name}</span>
            <span className="text-xs text-muted-foreground">{actor.email}</span>
          </span>
        </div>
      </header>
      <section className="flex flex-col items-start gap-6 rounded-[22px] bg-card p-6 sm:p-8">
        <div className="flex flex-col gap-2">
          <h1 className="text-4xl font-semibold tracking-tight">
            Welcome, {actor.name}
          </h1>
          <p className="text-sm text-muted-foreground">
            Your dashboard is on its way. Soon you&apos;ll manage pages,
            articles and enquiries from here.
          </p>
        </div>
        <ul aria-label="Your roles" className="flex flex-wrap gap-2">
          {actor.roles.map((role) => (
            <li
              key={role}
              className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground capitalize"
            >
              {role}
            </li>
          ))}
        </ul>
        <SignOutButton />
      </section>
    </div>
  )
}
