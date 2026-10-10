"use client"

import { useState } from "react"

import { track } from "@/lib/tracking/track"

const button =
  "flex h-10 cursor-pointer items-center justify-center rounded-full border border-line px-4 text-sm leading-[1.5] font-medium text-ink-muted transition-colors duration-300 outline-none hover:border-pine/40 hover:text-ink focus-visible:ring-3 focus-visible:ring-clay/50"

// Copy the article link, or open a pre-filled email with it.
export function ShareLinks({
  title,
  copy,
}: {
  title: string
  copy: { copyLink: string; linkCopied: string; shareEmail: string }
}) {
  const [copied, setCopied] = useState(false)

  const copyAddress = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      track({
        event: "share",
        params: { method: "copy_link", content_type: "article" },
      })
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the address bar still has the link.
    }
  }

  const email = () => {
    track({
      event: "share",
      params: { method: "email", content_type: "article" },
    })
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(window.location.href)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copyAddress} className={button}>
        <span aria-live="polite">
          {copied ? copy.linkCopied : copy.copyLink}
        </span>
      </button>
      <button type="button" onClick={email} className={button}>
        {copy.shareEmail}
      </button>
    </div>
  )
}
