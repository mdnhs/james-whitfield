// app/(admin)/admin/(panel)/settings/ai-assistant/page.tsx
import type { Metadata } from "next"
import { Suspense } from "react"

import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { AiSettingsView } from "@/admin/modules/ai/settings-view"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "AI assistant" }

export default function AiAssistantSettingsPage() {
  return (
    <Suspense fallback={<CardSkeleton />}>
      <Gate />
    </Suspense>
  )
}

// Ruling R16: gated on the permission itself, because lib/admin/nav.ts (the
// registry permissionFor reads) gets no entry in this plan.
async function Gate() {
  await requirePermission({ ai: ["manage"] }, "/admin/settings/ai-assistant")
  return <AiSettingsView />
}
