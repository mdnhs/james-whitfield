import type { Metadata } from "next"
import { io } from "next/cache"
import { notFound } from "next/navigation"
import { Suspense } from "react"

import { NewsletterState } from "@/features/newsletter/components/newsletter-state"
import { getSetting } from "@/server/modules/content/queries"

const STATES = ["confirmed", "invalid", "unsubscribe", "unsubscribed"] as const
type State = (typeof STATES)[number]

// The unsubscribe link carries a token in its query string: send no Referer.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
  referrer: "no-referrer",
}
export const generateStaticParams = () => STATES.map((state) => ({ state }))

export default function Page({
  params,
}: {
  params: Promise<{ state: string }>
}) {
  return (
    <Suspense fallback={null}>
      <Body params={params} />
    </Suspense>
  )
}

async function Body({ params }: { params: Promise<{ state: string }> }) {
  const { state } = await params
  if (!STATES.includes(state as State)) notFound()
  await io()
  const { pages } = await getSetting("newsletter")
  if (state === "unsubscribe")
    return (
      <NewsletterState
        state="unsubscribe"
        copy={pages.unsubscribe}
        invalid={pages.invalid}
      />
    )
  return (
    <NewsletterState
      state={state as "confirmed" | "invalid" | "unsubscribed"}
      copy={pages[state as "confirmed" | "invalid" | "unsubscribed"]}
    />
  )
}
