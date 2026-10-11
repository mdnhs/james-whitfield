// admin/modules/ai/assistant-composer.tsx
"use client"

import { cn } from "cn"
import { ArrowUpIcon, FileTextIcon, SquareIcon, XIcon } from "lucide-react"
import { useId, useLayoutEffect, type RefObject } from "react"

import { Button } from "@/components/ui/button"
import { GEMINI_FREE_TIER_WARNING, MAX_INPUT_CHARS } from "@/lib/ai/schema"

import { AI_GRADIENT } from "./ai-avatar"

export const MAX_LINES = 8
// The counter appears for the last 1 000 characters.
export const COUNTER_FROM = MAX_INPUT_CHARS - 1000

// Grows the box with its text up to `maxLines`, then scrolls inside it.
export function fitTextarea(el: HTMLTextAreaElement, maxLines = MAX_LINES) {
  const style = getComputedStyle(el)
  const line = Number.parseFloat(style.lineHeight) || 24
  const padding =
    (Number.parseFloat(style.paddingTop) || 0) +
    (Number.parseFloat(style.paddingBottom) || 0)
  const max = line * maxLines + padding
  el.style.height = "auto"
  const height = Math.min(el.scrollHeight, max)
  el.style.height = `${height}px`
  el.style.overflowY = el.scrollHeight > max ? "auto" : "hidden"
}

const count = (n: number) => n.toLocaleString("en-IE")

export function Composer({
  boxRef,
  draft,
  onDraft,
  onSend,
  onStop,
  busy,
  readOnly,
  freeTierWarning,
  contextLabel,
  onDismissContext,
}: {
  boxRef: RefObject<HTMLTextAreaElement | null>
  draft: string
  onDraft: (text: string) => void
  onSend: () => void
  onStop: () => void
  busy: boolean
  readOnly: boolean
  freeTierWarning: boolean
  // "About page" while it will go with the next message.
  contextLabel: string | null
  onDismissContext: () => void
}) {
  const counterId = useId()
  const hintId = useId()
  useLayoutEffect(() => {
    if (boxRef.current) fitTextarea(boxRef.current)
  }, [draft, boxRef])
  const length = draft.length
  const showCounter = length >= COUNTER_FROM
  const canSend = !busy && !readOnly && draft.trim().length > 0

  return (
    <form
      className="shrink-0 px-4 pt-2 pb-4 sm:px-6"
      onSubmit={(e) => {
        e.preventDefault()
        if (canSend) onSend()
      }}
    >
      <div className="mx-auto flex w-full max-w-176 flex-col gap-2">
        {freeTierWarning ? (
          <p role="note" className="text-xs text-muted-foreground">
            {GEMINI_FREE_TIER_WARNING}
          </p>
        ) : null}
        {readOnly ? (
          <p className="text-xs text-muted-foreground">
            You can read conversations while viewing as someone, but not send
            messages.
          </p>
        ) : null}
        {contextLabel && !readOnly ? (
          <div className="flex">
            <span className="inline-flex max-w-full items-center gap-1.5 rounded-full border bg-card py-0.5 pr-0.5 pl-2.5 text-xs">
              <FileTextIcon
                aria-hidden="true"
                className="size-3.5 shrink-0 text-primary"
              />
              <span className="truncate">
                Using: <span className="font-medium">{contextLabel}</span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon-xs"
                className="rounded-full"
                aria-label={`Don't use ${contextLabel} for the next message`}
                onClick={onDismissContext}
              >
                <XIcon />
              </Button>
            </span>
          </div>
        ) : null}
        <div
          className={cn(
            "rounded-2xl border bg-card shadow-xs transition-shadow",
            "focus-within:border-primary/70 focus-within:ring-3 focus-within:ring-ring/20",
            readOnly && "opacity-60"
          )}
        >
          <textarea
            ref={boxRef}
            aria-label="Message the AI assistant"
            aria-describedby={showCounter ? `${hintId} ${counterId}` : hintId}
            placeholder="Ask for a draft, a rewrite or SEO help"
            value={draft}
            maxLength={MAX_INPUT_CHARS}
            disabled={readOnly}
            rows={1}
            className="block max-h-[calc(8*1.5rem+1.25rem)] min-h-11 w-full resize-none bg-transparent px-4 pt-3 pb-2 text-[0.9375rem] leading-6 outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed"
            onChange={(e) => onDraft(e.target.value)}
            onKeyDown={(e) => {
              if (
                e.key === "Enter" &&
                !e.shiftKey &&
                !e.nativeEvent.isComposing
              ) {
                e.preventDefault()
                if (canSend) onSend()
              }
            }}
          />
          <div className="flex items-center gap-2 pr-2 pb-2 pl-4">
            <span
              id={hintId}
              className="hidden min-w-0 truncate text-xs text-muted-foreground sm:inline"
            >
              Enter to send, Shift+Enter for a new line
            </span>
            {showCounter ? (
              <span
                id={counterId}
                className={cn(
                  "ml-auto text-xs tabular-nums",
                  length >= MAX_INPUT_CHARS - 200
                    ? "text-warning font-medium"
                    : "text-muted-foreground"
                )}
              >
                {count(length)} / {count(MAX_INPUT_CHARS)}
                <span className="sr-only"> characters</span>
              </span>
            ) : null}
            {busy ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className={cn("rounded-full", !showCounter && "ml-auto")}
                onClick={onStop}
              >
                <SquareIcon data-icon="inline-start" className="fill-current" />
                Stop
              </Button>
            ) : (
              <Button
                type="submit"
                size="icon"
                aria-label="Send"
                disabled={!canSend}
                className={cn(
                  "size-9 rounded-full text-primary-foreground transition-shadow",
                  !showCounter && "ml-auto",
                  "hover:shadow-[0_0_0_4px_color-mix(in_oklch,var(--primary)_18%,transparent),0_6px_18px_-6px_color-mix(in_oklch,var(--primary)_70%,transparent)]",
                  "disabled:bg-muted disabled:bg-none disabled:text-muted-foreground disabled:opacity-100"
                )}
                style={canSend ? { backgroundImage: AI_GRADIENT } : undefined}
              >
                <ArrowUpIcon className="size-4.5" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </form>
  )
}
