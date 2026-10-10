"use client"

import { useSearchParams } from "next/navigation"
import { Suspense } from "react"

// The token lives only in the query string and is read in the browser, so the
// prerendered shell carries nothing per-person. A plain form POST (no script
// needed) does the unsubscribe: a mail scanner following the link cannot.
type Copy = { title: string; body: string }

function Form({ button, invalid }: { button: string; invalid: Copy }) {
  const token = useSearchParams().get("token")
  if (!token)
    return (
      <div role="alert">
        <p className="font-display text-2xl font-bold text-pine">
          {invalid.title}
        </p>
        <p className="mt-2 text-base leading-[1.5]">{invalid.body}</p>
      </div>
    )
  return (
    <form method="post" action="/api/v1/public/newsletter/unsubscribe">
      <input type="hidden" name="token" value={token} />
      <button
        type="submit"
        className="cursor-pointer rounded-full bg-clay px-6.5 py-3.75 text-[15px] leading-[1.5] font-semibold text-cream transition-colors hover:bg-clay/90 focus-visible:ring-3 focus-visible:ring-clay/40 focus-visible:outline-none"
      >
        {button}
      </button>
    </form>
  )
}

export function UnsubscribeForm({
  button,
  invalid,
}: {
  button: string
  invalid: Copy
}) {
  return (
    <Suspense fallback={null}>
      <Form button={button} invalid={invalid} />
    </Suspense>
  )
}
