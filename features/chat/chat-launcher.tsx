"use client"

import dynamic from "next/dynamic"
import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

import { useChat } from "./use-chat"

// The panel (form, thread, Turnstile) stays out of the page bundle until the
// first click. The launcher itself is small and owns the polling hook so the
// unread dot works while the panel is closed.
const ChatPanel = dynamic(() => import("./chat-panel"), { ssr: false })

export function ChatLauncher({
  botName,
  welcome,
}: {
  botName: string
  welcome: string
}) {
  const [open, setOpen] = useState(false)
  const [everOpened, setEverOpened] = useState(false)
  const button = useRef<HTMLButtonElement>(null)
  const wasOpen = useRef(false)
  const chat = useChat(open)

  // Focus returns to the launcher once it is visible again.
  useEffect(() => {
    if (wasOpen.current && !open) button.current?.focus()
    wasOpen.current = open
  }, [open])

  return (
    <>
      <button
        ref={button}
        type="button"
        aria-label={chat.unread ? "Open chat, new message" : "Open chat"}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => {
          setEverOpened(true)
          setOpen(true)
        }}
        style={{
          bottom:
            "calc(max(1rem, env(safe-area-inset-bottom)) + var(--sticky-cta-h, 0px))",
        }}
        className={cn(
          "fixed right-4 z-40 grid size-14 place-items-center rounded-full bg-brand text-cream shadow-lg transition-[transform,background-color,bottom] duration-300 ease-out hover:scale-105 hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none",
          open && "invisible"
        )}
      >
        <svg
          viewBox="0 0 24 24"
          width="26"
          height="26"
          aria-hidden
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20.5l1.7-5A8.5 8.5 0 1 1 21 11.5Z" />
        </svg>
        {chat.unread ? (
          <span
            aria-hidden
            className="absolute top-1 right-1 size-3.5 rounded-full border-2 border-cream bg-clay"
          />
        ) : null}
      </button>
      {everOpened && open ? (
        <ChatPanel
          chat={chat}
          botName={botName}
          welcome={welcome}
          onClose={() => setOpen(false)}
        />
      ) : null}
    </>
  )
}
