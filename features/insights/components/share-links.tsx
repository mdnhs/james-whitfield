"use client"

import { useState } from "react"

const button =
  "flex h-10 cursor-pointer items-center justify-center rounded-full border border-[#dfe2d8] px-4 text-sm leading-[1.5] font-medium text-ink-muted transition-colors duration-300 outline-none hover:border-pine/40 hover:text-ink focus-visible:ring-3 focus-visible:ring-clay/50"

// Copy the article link, or open a pre-filled email with it.
export function ShareLinks({ title }: { title: string }) {
  const [copied, setCopied] = useState(false)

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // Clipboard can be blocked; the address bar still has the link.
    }
  }

  const email = () => {
    const subject = encodeURIComponent(title)
    const body = encodeURIComponent(window.location.href)
    window.location.href = `mailto:?subject=${subject}&body=${body}`
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button type="button" onClick={copy} className={button}>
        <span aria-live="polite">{copied ? "Link copied" : "Copy link"}</span>
      </button>
      <button type="button" onClick={email} className={button}>
        Email
      </button>
    </div>
  )
}
