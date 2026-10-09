import type { Metadata } from "next"
import { Suspense } from "react"

import { SignOutButton } from "@/admin/modules/auth/sign-out-button"
import { requireActor } from "@/server/auth/session"

export const metadata: Metadata = { title: "Dashboard" }

// Placeholder until the Phase 2 dashboard; the shell around it is real.
export default function DashboardPage() {
  return (
    <Suspense fallback={null}>
      <Welcome />
    </Suspense>
  )
}

async function Welcome() {
  const actor = await requireActor()
  return (
    <section className="flex flex-col items-start gap-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-semibold tracking-tight">
          Welcome, {actor.name}
        </h1>
        <p className="text-sm text-muted-foreground">
          Your dashboard is on its way. Soon you&apos;ll manage pages, articles
          and enquiries from here.
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
  )
}
