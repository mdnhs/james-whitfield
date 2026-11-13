import type { Metadata } from "next"

import { ServiceCardPreview } from "@/features/services/components/service-card-preview"

export const metadata: Metadata = { title: "Card preview" }

// The admin's live card preview. The proxy keeps /admin/* signed-in only; the
// card shows only what the editor's form sends it.
export default function ServiceCardPreviewPage() {
  return <ServiceCardPreview />
}
