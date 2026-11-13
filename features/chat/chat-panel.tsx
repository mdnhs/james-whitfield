"use client"

import { MessageCircle, SendHorizontal, X } from "lucide-react"
import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"

import { Turnstile } from "@/features/contact/components/turnstile"
import type { ChatStatus, VisitorMessage } from "@/lib/chat/schema"
import { cn } from "@/lib/utils"

import { TypingIndicator } from "./typing-indicator"
import { usePanelMoments } from "./use-chat-moments"
import type { ChatApi } from "./use-chat"
import { usePanelMotion } from "./use-widget-motion"

// A preset question from the hint. `id` changes on every pick, so picking the
// same one twice sends it twice.
export type Preset = { id: number; text: string }

const DEFAULT_OFFLINE =
  "No one is online right now. Leave your email and Magda's team will reply."
const TYPING_MS = 30_000
const MESSAGE_MAX = 2000
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), textarea:not([disabled]), a[href]'

const field =
  "w-full rounded-2xl border border-brand/25 bg-white px-4 py-2.5 text-base text-ink placeholder:text-ink-muted/60 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
const pill =
  "inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-base font-medium text-cream transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"
const bubble =
  "max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-6 break-words whitespace-pre-wrap"
const theirs = "rounded-bl-md bg-mist text-ink"

// Plain text only: bodies render as React text, never as markup or links.
function Bubble({ m, botName }: { m: VisitorMessage; botName: string }) {
  if (m.sender === "system") {
    return (
      <li
        data-message-id={m.id}
        data-sender={m.sender}
        className="px-4 text-center text-sm whitespace-pre-wrap text-ink-muted"
      >
        {m.body}
      </li>
    )
  }
  const mine = m.sender === "visitor"
  const caption =
    m.sender === "ai"
      ? `${botName} · AI`
      : m.sender === "staff"
        ? m.senderName
        : null
  return (
    <li
      data-message-id={m.id}
      data-sender={m.sender}
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      {caption ? (
        <span className="px-1 text-xs font-medium text-ink-muted">
          {caption}
        </span>
      ) : null}
      <p
        className={cn(
          bubble,
          mine
            ? "rounded-br-md bg-brand text-cream"
            : m.sender === "ai"
              ? theirs
              : "rounded-bl-md border border-brand/20 bg-white text-ink"
        )}
      >
        {m.body}
      </p>
    </li>
  )
}

function ConsentLine({ quiet }: { quiet: boolean }) {
  return (
    <p
      className={cn(
        "text-ink-muted",
        quiet ? "mt-2 text-xs leading-4" : "mb-2 text-[13px] leading-5"
      )}
    >
      Messages are read by an AI assistant and Magda&apos;s team. Please
      don&apos;t share health details here.{" "}
      <Link
        href="/privacy"
        target="_blank"
        rel="noopener"
        className="underline underline-offset-2 hover:text-brand-deep"
      >
        Privacy policy
      </Link>
    </p>
  )
}

function EmailAsk({ chat, note }: { chat: ChatApi; note: string }) {
  const [error, setError] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const email = String(
      new FormData(e.currentTarget).get("email") ?? ""
    ).trim()
    setPending(true)
    const result = await chat.saveEmail(email)
    setPending(false)
    setError(
      result.ok ? null : "Please check that email address and try again."
    )
  }
  return (
    <form
      onSubmit={submit}
      className="mt-1 flex flex-col gap-2 rounded-2xl border border-brand/20 bg-white/70 p-3"
    >
      <label htmlFor="chat-email-ask" className="text-sm text-ink">
        {note}
      </label>
      <input
        id="chat-email-ask"
        name="email"
        type="email"
        required
        autoComplete="email"
        maxLength={254}
        placeholder="you@example.com"
        className={field}
      />
      <button type="submit" disabled={pending} className={pill}>
        Save email
      </button>
      {error ? <p className="text-sm text-[#a33a1f]">{error}</p> : null}
    </form>
  )
}

export function ChatPanel({
  chat,
  status,
  botName,
  welcome,
  open,
  preset,
  onClose,
  onClosed,
}: {
  chat: ChatApi
  status: ChatStatus | null
  botName: string
  welcome: string
  open: boolean
  preset: Preset | null
  onClose(): void
  onClosed(): void
}) {
  const titleId = useId()
  const dialog = usePanelMotion(open, onClosed)
  const composer = useRef<HTMLTextAreaElement>(null)
  const restart = useRef<HTMLButtonElement>(null)
  const scroller = useRef<HTMLDivElement>(null)
  const seen = useRef<Set<number> | null>(null)

  const [draft, setDraft] = useState("")
  const [honeypot, setHoneypot] = useState("")
  const [sending, setSending] = useState(false)
  // A message waiting to go: for the cookie lookup, or for Turnstile.
  const [queued, setQueued] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [token, setToken] = useState<string | null>(null)
  const [widget, setWidget] = useState(0)
  const [announcement, setAnnouncement] = useState("")
  const [expiredFor, setExpiredFor] = useState<number | null>(null)

  const { messages, loaded, exists, ended, agentName, botActive } = chat
  const last = messages.at(-1)
  const online = status?.online ?? false
  const siteKey = status?.turnstileSiteKey ?? null
  const offlineNote = status?.offlineNote || DEFAULT_OFFLINE
  // Before the first message there is no conversation to ask, so the site's
  // status says whether the assistant will answer.
  const botAnswers = exists ? botActive : (status?.botActive ?? false)

  const { avatar, statusLine, onlineDot } = usePanelMoments({
    messageIds: messages.map((m) => m.id),
    agentName,
    online,
    log: scroller,
  })

  // A new preset fills the composer and queues it: adjust during render, not
  // in an effect. An ended chat has no composer, so it only opens.
  const [presetSeen, setPresetSeen] = useState(0)
  if (preset && preset.id !== presetSeen) {
    setPresetSeen(preset.id)
    if (preset.text && !ended) {
      setDraft(preset.text)
      setQueued(true)
    }
  }

  // Focus the composer on open (or Start a new chat once a chat ended), and
  // again when the view swaps between the two.
  useEffect(() => {
    if (!open) return
    if (ended) restart.current?.focus()
    else composer.current?.focus({ preventScroll: true })
  }, [open, ended])

  useEffect(() => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length, last?.sender])

  // Screen readers hear only new messages from someone else, never the
  // visitor's own and never the history restored on open.
  useEffect(() => {
    if (!loaded) return
    if (!seen.current) {
      seen.current = new Set(messages.map((m) => m.id))
      return
    }
    const fresh = messages.filter((m) => !seen.current!.has(m.id))
    for (const m of fresh) seen.current.add(m.id)
    const text = fresh
      .filter((m) => m.sender !== "visitor")
      .map((m) => m.body)
      .join(". ")
    if (text) setAnnouncement(text)
  }, [messages, loaded])

  const typing =
    botActive && !ended && last?.sender === "visitor" && expiredFor !== last.id
  const lastVisitorId = last?.sender === "visitor" ? last.id : null
  useEffect(() => {
    if (lastVisitorId === null) return
    const id = lastVisitorId
    const t = setTimeout(() => setExpiredFor(id), TYPING_MS)
    return () => clearTimeout(t)
  }, [lastVisitorId])

  function onKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    if (e.key === "Escape") {
      e.stopPropagation()
      onClose()
      return
    }
    if (e.key !== "Tab") return
    const items = [
      ...(dialog.current?.querySelectorAll<HTMLElement>(FOCUSABLE) ?? []),
    ]
    if (!items.length) return
    const first = items[0]!
    const lastEl = items[items.length - 1]!
    const active = document.activeElement
    if (e.shiftKey && (active === first || active === dialog.current)) {
      e.preventDefault()
      lastEl.focus()
    } else if (!e.shiftKey && active === lastEl) {
      e.preventDefault()
      first.focus()
    }
  }

  // The first message starts the chat; sending it is the consent. It waits
  // for the cookie lookup (an open chat must not be started twice) and, when
  // Turnstile is on, for its token.
  async function submit() {
    const body = draft.trim()
    if (!body || sending || ended) {
      if (!sending) setQueued(false)
      return
    }
    if (!exists && (!loaded || (siteKey && !token))) {
      setQueued(true)
      return
    }
    setQueued(false)
    setSending(true)
    setError(null)
    if (exists) {
      const ok = await chat.send(body)
      setSending(false)
      if (ok) setDraft("")
      return
    }
    const result = await chat.start({
      message: body,
      consent: true,
      sourcePath: window.location.pathname,
      website: honeypot,
      turnstileToken: token ?? undefined,
    })
    setSending(false)
    if (result.ok) {
      setDraft("")
      return
    }
    setToken(null)
    setWidget((n) => n + 1)
    if (result.kind === "invalid")
      setError(
        result.fieldErrors.message
          ? "Please write a shorter message."
          : "We couldn't start the chat. Please try again."
      )
    else if (result.kind === "other" || result.kind === "notfound")
      setError("Something went wrong. Please try again.")
  }

  const ready = exists || (loaded && (!siteKey || Boolean(token)))
  useEffect(() => {
    if (!queued || sending || !ready) return
    // The queued message goes as soon as the lookup or Turnstile is done.
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sends a message the visitor already asked to send
    void submit()
  })

  const statusText = chat.reconnecting
    ? "Reconnecting…"
    : agentName
      ? `Chatting with ${agentName}`
      : botAnswers
        ? `${botName} (AI) · Magda's team can join`
        : online
          ? "We're online"
          : "We'll reply as soon as we can"

  const notice =
    chat.notice === "offline"
      ? "You seem to be offline. We'll keep trying."
      : chat.notice === "rate"
        ? "You're sending messages quickly. Please wait a moment."
        : chat.notice === "ended" || ended
          ? "This chat has ended."
          : null

  // VANTAGE's rule: ask only when no one can answer here and now.
  const askEmail =
    exists && !ended && !agentName && !chat.emailSaved && !botActive && !online

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      inert={!open}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-60 flex h-svh w-full flex-col overflow-hidden bg-cream text-ink shadow-2xl outline-none sm:inset-auto sm:right-4 sm:bottom-[calc(max(1rem,env(safe-area-inset-bottom))+4.75rem)] sm:h-[min(560px,calc(100svh-7rem))] sm:w-95 sm:rounded-3xl sm:border sm:border-brand/20 sm:right-6"
    >
      <header
        data-chat-part
        className="flex items-center gap-3 bg-brand px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-4 text-cream sm:pt-4"
      >
        <span
          ref={avatar}
          className="relative grid size-11 shrink-0 place-items-center rounded-full bg-cream/15 ring-1 ring-cream/25"
        >
          {agentName ? (
            <span className="font-display text-lg font-semibold">
              {agentName[0]?.toUpperCase()}
            </span>
          ) : (
            <MessageCircle className="size-5" aria-hidden />
          )}
          {online ? (
            <span
              ref={onlineDot}
              aria-hidden
              className="absolute -top-0.5 -right-0.5 size-3 rounded-full border-2 border-brand bg-emerald-400"
            />
          ) : null}
        </span>
        <div className="min-w-0 flex-1">
          <h2
            id={titleId}
            className="font-display text-xl leading-6 font-bold [font-variation-settings:'SOFT'_0,'WONK'_1]"
          >
            Chat with us
          </h2>
          <p ref={statusLine} className="truncate text-sm leading-5 text-cream/80">
            {statusText}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="grid size-11 shrink-0 place-items-center rounded-full text-cream transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cream"
        >
          <X className="size-5" aria-hidden />
        </button>
      </header>

      <div
        ref={scroller}
        data-chat-part
        data-lenis-prevent
        className="flex flex-1 flex-col gap-3 overflow-y-auto overscroll-contain px-4 py-4"
      >
        <ul
          role="log"
          aria-live="off"
          aria-label="Conversation"
          className="flex flex-col gap-3"
        >
          <li className="flex flex-col items-start">
            <p className={cn(bubble, theirs)}>{welcome}</p>
          </li>
          {messages.map((m) => (
            <Bubble key={m.id} m={m} botName={botName} />
          ))}
        </ul>
        {typing ? <TypingIndicator name={botName} /> : null}
        {askEmail ? <EmailAsk chat={chat} note={offlineNote} /> : null}
      </div>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>

      <div
        data-chat-part
        className="border-t border-brand/15 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        {notice || error ? (
          <p role="alert" className="mb-2 text-sm text-[#a33a1f]">
            {error ?? notice}
          </p>
        ) : null}
        {ended ? (
          <button
            ref={restart}
            type="button"
            onClick={chat.startNew}
            className={cn(pill, "w-full")}
          >
            Start a new chat
          </button>
        ) : (
          <>
            {!exists ? <ConsentLine quiet={false} /> : null}
            {!exists && siteKey ? (
              <div className="mb-2">
                <Turnstile
                  key={widget}
                  siteKey={siteKey}
                  action="chat"
                  onToken={setToken}
                />
              </div>
            ) : null}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                void submit()
              }}
              className="flex items-end gap-2"
            >
              <textarea
                ref={composer}
                aria-label="Your message"
                placeholder="Write a message"
                value={draft}
                rows={1}
                maxLength={MESSAGE_MAX}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (
                    e.key === "Enter" &&
                    !e.shiftKey &&
                    !e.nativeEvent.isComposing
                  ) {
                    e.preventDefault()
                    void submit()
                  }
                }}
                data-lenis-prevent
                className={cn(field, "max-h-28 min-h-11 min-w-0 flex-1 resize-none")}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                aria-label="Send message"
                className="grid size-11 shrink-0 place-items-center rounded-full bg-brand text-cream transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-50"
              >
                <SendHorizontal className="size-5" aria-hidden />
              </button>
            </form>
            {queued && !exists ? (
              <p role="status" className="mt-2 text-xs text-ink-muted">
                One moment, connecting…
              </p>
            ) : null}
            {exists ? <ConsentLine quiet /> : null}
          </>
        )}
        {/* Off-screen for people; bots fill it in. */}
        <input
          tabIndex={-1}
          aria-hidden
          autoComplete="off"
          name="website"
          value={honeypot}
          onChange={(e) => setHoneypot(e.target.value)}
          className="absolute -left-[9999px] size-px opacity-0"
        />
      </div>
    </div>
  )
}

export default ChatPanel
