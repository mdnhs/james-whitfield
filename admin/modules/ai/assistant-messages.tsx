// admin/modules/ai/assistant-messages.tsx
"use client"

import {
  CheckIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  SearchIcon,
} from "lucide-react"
import { useId, useLayoutEffect, useRef, useState } from "react"

import { Button } from "@/components/ui/button"
import { textOf, toolLabel, type AiUIMessage } from "@/lib/ai/messages"
import { MAX_INPUT_CHARS } from "@/lib/ai/schema"

import { AiAvatar } from "./ai-avatar"
import { fitTextarea } from "./assistant-composer"
import { Markdown } from "./markdown"
import type { AssistantScreen } from "./route-context"
import type { Starter } from "./starters"
import { useCopy } from "./use-copy"

export function UserMessage({
  message,
  canEdit,
  onEdit,
}: {
  message: AiUIMessage
  canEdit: boolean
  onEdit: (text: string) => void
}) {
  const text = textOf(message)
  const [editing, setEditing] = useState(false)
  if (editing)
    return (
      <EditBox
        initial={text}
        onCancel={() => setEditing(false)}
        onSave={(next) => {
          setEditing(false)
          onEdit(next)
        }}
      />
    )
  return (
    <div className="flex flex-col items-end gap-1 pl-10">
      <div className="max-w-full rounded-2xl rounded-br-md bg-primary/15 px-3.5 py-2 text-[0.9375rem] leading-relaxed wrap-break-word whitespace-pre-wrap">
        {text}
      </div>
      {canEdit ? (
        <Button
          variant="ghost"
          size="xs"
          className="text-muted-foreground"
          onClick={() => setEditing(true)}
        >
          <PencilIcon data-icon="inline-start" />
          Edit
        </Button>
      ) : null}
    </div>
  )
}

function EditBox({
  initial,
  onSave,
  onCancel,
}: {
  initial: string
  onSave: (text: string) => void
  onCancel: () => void
}) {
  const [text, setText] = useState(initial)
  const box = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    if (box.current) fitTextarea(box.current)
  }, [text])
  useLayoutEffect(() => {
    const el = box.current
    if (!el) return
    el.focus()
    el.setSelectionRange(el.value.length, el.value.length)
  }, [])
  const ok = text.trim().length > 0
  return (
    <form
      className="ml-10 flex flex-col gap-2 rounded-2xl border bg-card p-2 focus-within:border-primary/70 focus-within:ring-3 focus-within:ring-ring/20"
      onSubmit={(e) => {
        e.preventDefault()
        if (ok) onSave(text.trim())
      }}
    >
      <textarea
        ref={box}
        aria-label="Edit your message"
        value={text}
        maxLength={MAX_INPUT_CHARS}
        rows={1}
        className="block w-full resize-none bg-transparent px-2 py-1 text-[0.9375rem] leading-6 outline-none"
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault()
            if (ok) onSave(text.trim())
          }
        }}
      />
      <div className="flex items-center justify-end gap-1.5">
        <p className="mr-auto px-2 text-xs text-muted-foreground">
          Replaces this message and the reply after it
        </p>
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" size="sm" disabled={!ok}>
          Save
        </Button>
      </div>
    </form>
  )
}

export function AssistantMessage({
  message,
  canRegenerate,
  onRegenerate,
}: {
  message: AiUIMessage
  canRegenerate: boolean
  onRegenerate: () => void
}) {
  const text = textOf(message)
  const { copied, copy } = useCopy()
  return (
    <div className="flex gap-3">
      <AiAvatar className="mt-0.5" />
      <div className="flex min-w-0 flex-1 flex-col gap-2.5 text-[0.9375rem]">
        {message.parts.map((part, i) => {
          const label = toolLabel(part)
          if (label)
            return (
              <p
                key={i}
                className="inline-flex w-fit max-w-full items-center gap-1.5 rounded-full border bg-card px-2.5 py-0.5 text-xs text-muted-foreground"
              >
                <SearchIcon aria-hidden="true" className="size-3 shrink-0" />
                <span className="truncate">Looked at: {label}</span>
              </p>
            )
          if (part.type === "text") return <Markdown key={i} text={part.text} />
          return null
        })}
        {text || canRegenerate ? (
          <div className="-ml-2 flex items-center gap-0.5 text-muted-foreground">
            {text ? (
              <Button
                variant="ghost"
                size="xs"
                aria-label={copied ? "Copied" : "Copy"}
                onClick={() => void copy(text)}
              >
                {copied ? (
                  <CheckIcon
                    data-icon="inline-start"
                    className="text-primary"
                  />
                ) : (
                  <CopyIcon data-icon="inline-start" />
                )}
                {copied ? "Copied" : "Copy"}
              </Button>
            ) : null}
            {canRegenerate ? (
              <Button variant="ghost" size="xs" onClick={onRegenerate}>
                <RefreshCwIcon data-icon="inline-start" />
                Regenerate
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  )
}

// While the first token is on its way. Dots in the accent; still for people
// who ask for less motion (the admin's global rule stops them too).
export function TypingIndicator() {
  return (
    <div className="flex items-center gap-3">
      <AiAvatar />
      <span className="flex h-7 items-center gap-1" aria-hidden="true">
        {[0, 150, 300].map((delay) => (
          <span
            key={delay}
            className="size-1.5 rounded-full bg-primary motion-safe:animate-bounce"
            style={{ animationDelay: `${delay}ms` }}
          />
        ))}
      </span>
      <span className="sr-only">The assistant is writing</span>
    </div>
  )
}

const LEADS: Record<AssistantScreen, string> = {
  default:
    "I can draft and rewrite text, check SEO and look up pages, articles and enquiry numbers. I read the site but never change it.",
  page: "Ask about the page you're editing. I can read it and suggest text to paste, but I never change it.",
  article:
    "Ask about the article you're editing. I can read it and suggest text to paste, but I never change it.",
  leads:
    "I can count and summarise enquiries. Personal details stay out unless the owner has allowed them.",
}

function greeting(now = new Date()) {
  const h = now.getHours()
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"
}

export function EmptyState({
  firstName,
  screen,
  starters,
  onPick,
}: {
  firstName: string
  screen: AssistantScreen
  starters: Starter[]
  onPick: (prompt: string) => void
}) {
  return (
    <div className="flex flex-col gap-6 pt-2 sm:pt-6">
      <div className="flex flex-col items-start gap-3">
        <AiAvatar size="lg" />
        <div className="flex flex-col gap-1">
          <p className="text-[1.375rem] leading-tight font-semibold tracking-tight">
            {greeting()}
            {firstName ? `, ${firstName}` : ""}
          </p>
          <p className="max-w-[44ch] text-muted-foreground">{LEADS[screen]}</p>
        </div>
      </div>
      <ul aria-label="Suggestions" className="grid grid-cols-2 gap-2.5">
        {starters.map((s) => (
          <li key={s.title} className="flex">
            <StarterCard starter={s} onPick={onPick} />
          </li>
        ))}
      </ul>
    </div>
  )
}

function StarterCard({
  starter,
  onPick,
}: {
  starter: Starter
  onPick: (prompt: string) => void
}) {
  const titleId = useId()
  const descId = useId()
  const Icon = starter.icon
  return (
    <button
      type="button"
      aria-labelledby={titleId}
      aria-describedby={descId}
      onClick={() => onPick(starter.title)}
      className="flex w-full flex-col items-start gap-3 rounded-2xl border bg-card p-3.5 text-left transition-colors outline-none hover:border-primary/50 hover:bg-accent/40 focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <span className="grid size-8 place-items-center rounded-full bg-accent text-accent-foreground">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <span className="flex flex-col gap-0.5">
        <span id={titleId} className="text-sm leading-snug font-medium">
          {starter.title}
        </span>
        <span
          id={descId}
          className="text-xs leading-snug text-muted-foreground"
        >
          {starter.description}
        </span>
      </span>
    </button>
  )
}
