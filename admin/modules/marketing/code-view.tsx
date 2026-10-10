"use client"

import { GlobalEditor } from "@/admin/modules/globals/global-editor"

// The editor's History sheet is the rollback (brief §12.6).
export function CodeView({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p
        role="note"
        className="rounded-md border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
      >
        Custom code runs with full access to every visitor&apos;s page,
        including the enquiry form. Only add code from a source you trust.
        Snippets never run in the admin or in previews, and each runs once per
        page load.
      </p>
      {disabled ? (
        <p
          role="note"
          className="rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm"
        >
          Custom code is switched off on the server (DISABLE_CUSTOM_SCRIPTS).
          Saved snippets will not run until it is turned back on.
        </p>
      ) : null}
      <GlobalEditor title="Custom code" keys={["scripts"]} />
    </div>
  )
}
