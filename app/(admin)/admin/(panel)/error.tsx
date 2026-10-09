"use client"

import { useEffect } from "react"

import { Button } from "@/components/ui/button"

// docs/brief.md §9.4: error boundaries with retry. `retry` re-fetches and
// re-renders the segment (stable in Next 16.3).
export default function PanelError({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <section
      role="alert"
      className="mx-auto flex max-w-md flex-col items-center gap-4 py-16 text-center"
    >
      <h1 className="text-card-title">Something went wrong</h1>
      <p className="text-sm text-muted-foreground">
        This part of the admin didn&apos;t load. Nothing you saved is lost.
        {error.digest ? (
          <>
            {" "}
            Reference <code className="font-mono">{error.digest}</code>.
          </>
        ) : null}
      </p>
      <Button
        onClick={() => retry()}
        className="h-11 rounded-xl px-5 font-semibold"
      >
        Try again
      </Button>
    </section>
  )
}
