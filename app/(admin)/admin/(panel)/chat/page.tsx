import type { Metadata } from "next"
import { Suspense } from "react"

import { ChatPageSkeleton } from "@/admin/components/dashboard/page-skeletons"
import { ChatInbox } from "@/admin/modules/chat/chat-inbox"
import { permissionFor } from "@/lib/admin/nav"
import { requirePermission } from "@/server/auth/session"

export const metadata: Metadata = { title: "Live chat" }

export default function ChatPage() {
  return (
    <Suspense fallback={<ChatPageSkeleton />}>
      <Gate />
    </Suspense>
  )
}

async function Gate() {
  await requirePermission(permissionFor("/admin/chat"))
  return <ChatInbox />
}
