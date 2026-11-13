"use client"

import { MessageCircle, X } from "lucide-react"
import dynamic from "next/dynamic"
import { useCallback, useEffect, useRef, useState } from "react"

import type { ChatStatus } from "@/lib/chat/schema"

import { getStatus } from "./api"
import { ChatHint } from "./chat-hint"
import type { Preset } from "./chat-panel"
import { useChat } from "./use-chat"
import { useUnreadMoment } from "./use-chat-moments"
import { useLauncherMotion } from "./use-widget-motion"

// The panel (thread, composer, Turnstile) stays out of the page bundle until
// the first open. The launcher and hint are small and GSAP is already on every
// page; the launcher owns the polling hook so the unread badge works while the
// panel is closed.
const ChatPanel = dynamic(() => import("./chat-panel"), { ssr: false })

// Remembers only that the visitor hid the hint, for this browser tab.
const HINT_KEY = "chat-hint-hidden"
const hintWasHidden = () => {
  try {
    return sessionStorage.getItem(HINT_KEY) === "1"
  } catch {
    return false
  }
}
const rememberHintHidden = () => {
  try {
    sessionStorage.setItem(HINT_KEY, "1")
  } catch {
    // Private windows can refuse storage; the hint just returns next page.
  }
}

export function ChatLauncher({
  botName,
  welcome,
}: {
  botName: string
  welcome: string
}) {
  const [ready, setReady] = useState(false)
  const [open, setOpen] = useState(false)
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [hintHidden, setHintHidden] = useState(true)
  const [hintEntered, setHintEntered] = useState(false)
  const [preset, setPreset] = useState<Preset | null>(null)
  // The panel outlives `open` so it can animate away; assistive tech follows
  // `open` at once.
  const [panelMounted, setPanelMounted] = useState(false)
  if (open && !panelMounted) setPanelMounted(true)

  const presetId = useRef(0)
  const wasOpen = useRef(false)
  const chat = useChat(open)
  const { launcher, chatIcon, closeIcon } = useLauncherMotion(ready, open)
  const badge = useUnreadMoment(chat.unread, launcher)

  const refreshStatus = useCallback(() => {
    void getStatus().then((r) => {
      if (r.ok) setStatus(r.data)
    })
  }, [])

  useEffect(() => {
    // Browser-only values, read after hydration; the launcher renders nothing
    // on the server so its arrival can animate.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- see above
    setReady(true)
    setHintHidden(hintWasHidden())
    refreshStatus()
  }, [refreshStatus])

  // Focus returns to the launcher when the panel closes.
  useEffect(() => {
    if (wasOpen.current && !open) launcher.current?.focus()
    wasOpen.current = open
  }, [open, launcher])

  // Reopening mid-close plays the panel forward again, so it never reports
  // closed while open; render puts it back if it ever does.
  const onClosed = useCallback(() => setPanelMounted(false), [])

  if (!ready) return null

  const openPanel = (message?: string) => {
    setOpen(true)
    refreshStatus()
    if (message) setPreset({ id: ++presetId.current, text: message })
  }
  const close = () => setOpen(false)
  const online = status?.online ?? false

  return (
    <>
      {panelMounted ? (
        <ChatPanel
          chat={chat}
          status={status}
          botName={botName}
          welcome={welcome}
          open={open}
          preset={preset}
          onClose={close}
          onClosed={onClosed}
        />
      ) : null}
      <div
        style={{
          bottom:
            "calc(max(1rem, env(safe-area-inset-bottom)) + var(--sticky-cta-h, 0px))",
        }}
        className="fixed right-4 z-40 flex items-end gap-3 transition-[bottom] duration-300 ease-out motion-reduce:transition-none sm:right-6"
      >
        {!open && !hintHidden ? (
          <ChatHint
            online={online}
            skipEntrance={hintEntered}
            onEntered={() => setHintEntered(true)}
            onOpen={openPanel}
            onGone={() => {
              rememberHintHidden()
              setHintHidden(true)
            }}
          />
        ) : null}
        <button
          ref={launcher}
          type="button"
          aria-label={
            open
              ? "Close chat"
              : chat.unread
                ? "Open chat, new message"
                : "Open chat"
          }
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => (open ? close() : openPanel())}
          className="relative grid size-14 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-cream shadow-lg transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand motion-reduce:transition-none"
        >
          <span
            ref={chatIcon}
            className="absolute inset-0 grid place-items-center"
          >
            <MessageCircle className="size-6.5" strokeWidth={1.8} aria-hidden />
          </span>
          <span
            ref={closeIcon}
            className="absolute inset-0 grid place-items-center opacity-0"
          >
            <X className="size-6.5" strokeWidth={1.8} aria-hidden />
          </span>
          {chat.unread && !open ? (
            <span
              ref={badge}
              aria-hidden
              className="absolute top-0.5 right-0.5 size-4 rounded-full border-2 border-cream bg-clay"
            />
          ) : online ? (
            <span
              aria-hidden
              className="absolute top-0.5 right-0.5 size-3.5 rounded-full border-2 border-cream bg-emerald-500"
            />
          ) : null}
        </button>
      </div>
    </>
  )
}
