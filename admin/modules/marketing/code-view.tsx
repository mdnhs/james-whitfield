"use client"

import { PowerOffIcon, TriangleAlertIcon } from "lucide-react"

import { subnavIcon } from "@/admin/components/shell/nav-icons"
import { GlobalEditor } from "@/admin/modules/globals/global-editor"

// The editor's History sheet is the rollback (brief §12.6).
export function CodeView({ disabled }: { disabled: boolean }) {
  return (
    <div className="flex flex-col gap-4">
      <p
        role="note"
        className="flex items-start gap-2.5 rounded-xl border border-amber-500/50 bg-amber-500/10 p-3 text-sm"
      >
        <TriangleAlertIcon
          aria-hidden
          className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
        />
        <span>
          Custom code runs with full access to every visitor&apos;s page,
          including the enquiry form. Only add code from a source you trust.
          Snippets never run in the admin or in previews, and each runs once per
          page load.
        </span>
      </p>
      {disabled ? (
        <p
          role="note"
          className="flex items-start gap-2.5 rounded-xl border border-destructive/50 bg-destructive/10 p-3 text-sm"
        >
          <PowerOffIcon
            aria-hidden
            className="mt-0.5 size-4 shrink-0 text-destructive"
          />
          <span>
            Custom code is switched off on the server (DISABLE_CUSTOM_SCRIPTS).
            Saved snippets will not run until it is turned back on.
          </span>
        </p>
      ) : null}
      <GlobalEditor
        title="Custom code"
        icon={subnavIcon("marketing-code")}
        description="Your own snippets on every public page."
        keys={["scripts"]}
      />
    </div>
  )
}
