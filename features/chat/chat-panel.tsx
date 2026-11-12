"use client"

import Link from "next/link"
import { useEffect, useId, useRef, useState } from "react"

import { Turnstile } from "@/features/contact/components/turnstile"
import type { ChatStatus, VisitorMessage } from "@/lib/chat/schema"
import { cn } from "@/lib/utils"

import { getStatus } from "./api"
import type { ChatApi } from "./use-chat"

const DEFAULT_OFFLINE =
  "No one is online right now. Leave your email and Magda's team will reply."
const TYPING_MS = 30_000
const FOCUSABLE =
  'button:not([disabled]), input:not([disabled]):not([type="hidden"]):not([tabindex="-1"]), textarea:not([disabled]), a[href]'

const field =
  "w-full rounded-xl border border-brand/25 bg-white px-3.5 py-2.5 text-base text-ink placeholder:text-ink-muted/60 focus-visible:border-brand focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand"
const pill =
  "inline-flex h-11 items-center justify-center rounded-full bg-brand px-6 text-base font-medium text-cream transition-colors hover:bg-brand-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand disabled:opacity-60"

type Errors = Partial<Record<"name" | "email" | "message" | "consent", string>>

function Bubble({ m, botName }: { m: VisitorMessage; botName: string }) {
  if (m.sender === "system") {
    return (
      <li className="px-4 text-center text-sm whitespace-pre-wrap text-ink-muted">
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
      className={cn("flex flex-col gap-1", mine ? "items-end" : "items-start")}
    >
      {caption ? (
        <span className="px-1 text-xs font-medium text-ink-muted">
          {caption}
        </span>
      ) : null}
      <p
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-2.5 text-base leading-6 break-words whitespace-pre-wrap",
          mine
            ? "rounded-br-md bg-brand text-cream"
            : m.sender === "ai"
              ? "rounded-bl-md bg-mist text-ink"
              : "rounded-bl-md border border-brand/20 bg-white text-ink"
        )}
      >
        {m.body}
      </p>
    </li>
  )
}

function StartForm({
  chat,
  welcome,
  status,
  firstField,
}: {
  chat: ChatApi
  welcome: string
  status: ChatStatus | null
  firstField: React.RefObject<HTMLInputElement | null>
}) {
  const [errors, setErrors] = useState<Errors>({})
  const [pending, setPending] = useState(false)
  const [token, setToken] = useState<string | null>(null)
  const [widget, setWidget] = useState(0)

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const data = new FormData(e.currentTarget)
    const text = (k: string) => String(data.get(k) ?? "").trim()
    const next: Errors = {}
    if (!text("name")) next.name = "Please enter your name."
    const email = text("email")
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
      next.email = "That email doesn't look right."
    if (!text("message")) next.message = "Please write a message."
    if (data.get("consent") !== "on")
      next.consent = "Please tick the box to start the chat."
    setErrors(next)
    if (Object.keys(next).length) return
    setPending(true)
    const result = await chat.start({
      name: text("name"),
      email,
      message: text("message"),
      consent: true,
      sourcePath: window.location.pathname,
      turnstileToken: token ?? undefined,
      website: text("website"),
    })
    setPending(false)
    if (!result.ok) {
      setToken(null)
      setWidget((n) => n + 1)
      if (result.kind === "invalid") {
        const fe = result.fieldErrors
        setErrors({
          name: fe.name ? "Please enter your name." : undefined,
          email: fe.email ? "That email doesn't look right." : undefined,
          message: fe.message ? "Please write a message." : undefined,
          consent: fe.consent
            ? "Please tick the box to start the chat."
            : undefined,
        })
      }
    }
  }

  const err = (k: keyof Errors) =>
    errors[k] ? (
      <p id={`chat-${k}-err`} className="mt-1 text-sm text-[#a33a1f]">
        {errors[k]}
      </p>
    ) : null
  const aria = (k: keyof Errors) => ({
    "aria-invalid": errors[k] ? true : undefined,
    "aria-describedby": errors[k] ? `chat-${k}-err` : undefined,
  })

  return (
    <form
      onSubmit={submit}
      noValidate
      className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-5"
    >
      <p className="text-base leading-6 text-ink">{welcome}</p>
      <div>
        <label
          htmlFor="chat-name"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Name
        </label>
        <input
          ref={firstField}
          id="chat-name"
          name="name"
          autoComplete="given-name"
          maxLength={80}
          className={field}
          {...aria("name")}
        />
        {err("name")}
      </div>
      <div>
        <label
          htmlFor="chat-email"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Email <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <input
          id="chat-email"
          name="email"
          type="email"
          autoComplete="email"
          className={field}
          {...aria("email")}
        />
        {err("email")}
      </div>
      <div>
        <label
          htmlFor="chat-message"
          className="mb-1 block text-sm font-medium text-ink"
        >
          Message
        </label>
        <textarea
          id="chat-message"
          name="message"
          rows={3}
          maxLength={2000}
          className={cn(field, "resize-none")}
          {...aria("message")}
        />
        {err("message")}
      </div>
      <div
        aria-hidden
        className="absolute -left-2499.75 h-0 w-0 overflow-hidden"
      >
        <input name="website" tabIndex={-1} autoComplete="off" />
      </div>
      <div>
        <label className="flex items-start gap-3 text-sm leading-5 text-ink">
          <input
            type="checkbox"
            name="consent"
            className="mt-0.5 size-5 shrink-0 accent-[#336060]"
            {...aria("consent")}
          />
          <span>
            I understand my messages are read by an AI assistant and by
            Magda&apos;s team. Health details are best kept for the session, so
            please don&apos;t share them here. See the{" "}
            <Link
              href="/privacy"
              target="_blank"
              rel="noopener"
              className="underline underline-offset-2"
            >
              privacy policy
            </Link>
            .
          </span>
        </label>
        {err("consent")}
      </div>
      {status?.turnstileSiteKey ? (
        <Turnstile
          key={widget}
          siteKey={status.turnstileSiteKey}
          action="chat"
          onToken={setToken}
        />
      ) : null}
      <button type="submit" disabled={pending} className={pill}>
        Start chat
      </button>
    </form>
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
      className="flex flex-col gap-2 border-t border-brand/15 bg-mist/60 px-4 py-3"
    >
      <label htmlFor="chat-email-ask" className="text-sm text-ink">
        {note}
      </label>
      <div className="flex gap-2">
        <input
          id="chat-email-ask"
          name="email"
          type="email"
          required
          autoComplete="email"
          className={cn(field, "min-w-0 flex-1")}
        />
        <button type="submit" disabled={pending} className={cn(pill, "px-4")}>
          Save email
        </button>
      </div>
      {error ? <p className="text-sm text-[#a33a1f]">{error}</p> : null}
    </form>
  )
}

export function ChatPanel({
  chat,
  botName,
  welcome,
  onClose,
}: {
  chat: ChatApi
  botName: string
  welcome: string
  onClose(): void
}) {
  const titleId = useId()
  const dialog = useRef<HTMLDivElement>(null)
  const nameField = useRef<HTMLInputElement>(null)
  const composer = useRef<HTMLTextAreaElement>(null)
  const restart = useRef<HTMLButtonElement>(null)
  const list = useRef<HTMLUListElement>(null)
  const focused = useRef(false)
  const seen = useRef<Set<number> | null>(null)

  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [draft, setDraft] = useState("")
  const [sending, setSending] = useState(false)
  const [announcement, setAnnouncement] = useState("")
  const [expiredFor, setExpiredFor] = useState<number | null>(null)

  const { messages, loaded, exists, ended } = chat
  const last = messages.at(-1)
  const online = status?.online ?? true
  const offlineNote = status?.offlineNote || DEFAULT_OFFLINE

  useEffect(() => {
    dialog.current?.focus()
    let alive = true
    void getStatus().then((r) => {
      if (alive && r.ok) setStatus(r.data)
    })
    return () => {
      alive = false
    }
  }, [])

  // First focus: the start form's first field, or the composer when a chat
  // exists. Until the cookie lookup lands, focus stays on the dialog.
  useEffect(() => {
    if (!loaded || focused.current) return
    focused.current = true
    ;(exists ? composer.current : nameField.current)?.focus()
  }, [loaded, exists])

  useEffect(() => {
    if (ended) restart.current?.focus()
  }, [ended])

  useEffect(() => {
    const el = list.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages.length])

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
    chat.botActive &&
    !ended &&
    last?.sender === "visitor" &&
    expiredFor !== last.id
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

  async function submitMessage(e?: React.FormEvent) {
    e?.preventDefault()
    const body = draft.trim()
    if (!body || sending) return
    setSending(true)
    const ok = await chat.send(body)
    setSending(false)
    if (ok) setDraft("")
  }

  const header = chat.botActive
    ? `${botName} (AI) · Magda's team can join`
    : chat.agentName
      ? `Chatting with ${chat.agentName}`
      : online
        ? "Magda's team will reply here"
        : offlineNote

  const notice =
    chat.notice === "offline"
      ? "You seem to be offline. We'll keep trying."
      : chat.notice === "rate"
        ? "You're sending messages quickly. Please wait a moment."
        : chat.notice === "ended" || ended
          ? "This chat has ended."
          : null

  const emailAsk =
    exists && !ended && !chat.emailSaved && (chat.needsHuman || !online)
  const emailNote = online
    ? "Want a reply by email too? Leave your address here."
    : offlineNote

  return (
    <div
      ref={dialog}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onKeyDown={onKeyDown}
      className="fixed inset-0 z-50 flex h-svh w-full flex-col overflow-hidden bg-cream text-ink shadow-2xl outline-none sm:inset-auto sm:right-4 sm:bottom-4 sm:h-140 sm:w-95 sm:rounded-3xl sm:border sm:border-brand/20"
    >
      <header className="flex items-start justify-between gap-3 bg-brand px-5 py-4 text-cream">
        <div className="min-w-0">
          <h2
            id={titleId}
            className="font-display text-xl leading-6 font-bold [font-variation-settings:'SOFT'_0,'WONK'_1]"
          >
            Chat with us
          </h2>
          <p className="mt-1 text-sm leading-5 text-cream/80">
            {chat.reconnecting ? "Reconnecting…" : header}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close chat"
          className="-mt-1 -mr-2 grid size-10 shrink-0 place-items-center rounded-full text-cream transition-colors hover:bg-white/10 focus-visible:outline-2 focus-visible:outline-cream"
        >
          <svg
            viewBox="0 0 24 24"
            width="20"
            height="20"
            aria-hidden
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          >
            <path d="M6 6l12 12M18 6L6 18" />
          </svg>
        </button>
      </header>

      {!exists ? (
        <StartForm
          chat={chat}
          welcome={welcome}
          status={status}
          firstField={nameField}
        />
      ) : (
        <>
          <ul
            ref={list}
            role="log"
            aria-live="off"
            aria-label="Conversation"
            className="flex flex-1 flex-col gap-3 overflow-y-auto px-4 py-4"
          >
            {messages.map((m) => (
              <Bubble key={m.id} m={m} botName={botName} />
            ))}
          </ul>
          <div className="sr-only" aria-live="polite" aria-atomic="true">
            {announcement}
          </div>
          {typing ? (
            <p role="status" className="px-5 pb-2 text-sm text-ink-muted">
              {botName} is typing…
            </p>
          ) : null}
          {notice ? (
            <p role="alert" className="px-5 pb-2 text-sm text-[#a33a1f]">
              {notice}
            </p>
          ) : null}
          {emailAsk ? <EmailAsk chat={chat} note={emailNote} /> : null}
          {ended ? (
            <div className="border-t border-brand/15 px-4 py-3">
              <button
                ref={restart}
                type="button"
                onClick={chat.startNew}
                className={cn(pill, "w-full")}
              >
                Start a new chat
              </button>
            </div>
          ) : (
            <form
              onSubmit={submitMessage}
              className="flex items-end gap-2 border-t border-brand/15 px-4 py-3"
            >
              <textarea
                ref={composer}
                aria-label="Your message"
                value={draft}
                rows={1}
                maxLength={2000}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault()
                    void submitMessage()
                  }
                }}
                className={cn(field, "max-h-28 min-w-0 flex-1 resize-none")}
              />
              <button
                type="submit"
                disabled={sending || !draft.trim()}
                className={cn(pill, "px-5")}
              >
                Send
              </button>
            </form>
          )}
        </>
      )}
    </div>
  )
}

export default ChatPanel
