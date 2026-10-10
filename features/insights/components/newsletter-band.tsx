"use client"

import { useState } from "react"

import { MediaImage } from "@/components/media-image"
import { EnterpriseBackdrop } from "@/features/enterprise/components/enterprise-backdrop"
import { tintStyle } from "@/lib/tint"

import type { NewsletterView } from "../newsletter-view"

export type { NewsletterView }

// Monthly letter sign-up. The server always answers 201 for a valid address
// (no enumeration), so success means "check your inbox", not "subscribed".
export function NewsletterBand({
  id,
  content,
}: {
  id: string
  content: NewsletterView
}) {
  const { eyebrow, title, subtitle, placeholder, button, success, emailLabel } =
    content
  const [done, setDone] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")

  async function submit(form: HTMLFormElement) {
    const data = new FormData(form)
    setPending(true)
    setError("")
    try {
      const res = await fetch("/api/v1/public/newsletter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: String(data.get("email") ?? ""),
          website: String(data.get("website") ?? ""),
          sourcePath: window.location.pathname,
        }),
      })
      if (res.status === 201) setDone(true)
      else if (res.status === 429) setError(content.errors.rateLimited)
      else if (res.status === 400) setError(content.errors.email)
      else setError(content.errors.generic)
    } catch {
      setError(content.errors.generic)
    } finally {
      setPending(false)
    }
  }

  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className="relative flex min-h-145 items-center overflow-clip py-20"
    >
      <EnterpriseBackdrop>
        {content.image && (
          <MediaImage
            media={content.image}
            alt=""
            fill
            sizes="100vw"
            blur
            className="object-cover"
          />
        )}
        <div className="absolute inset-0" style={tintStyle(content.tint)} />
      </EnterpriseBackdrop>

      <div className="relative mx-auto flex w-full max-w-150 flex-col items-center gap-7 px-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <span
            data-motion="rise"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border-[0.8px] border-line-neutral bg-white px-3.5 text-sm leading-4.5 font-medium tracking-[-0.28px] whitespace-nowrap text-moss"
          >
            <span aria-hidden className="size-1 rounded-full bg-moss" />
            {eyebrow}
          </span>
          <h2
            id={`${id}-heading`}
            data-motion="words"
            className="font-display text-[34px] leading-[1.15] font-bold text-cream [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[50px]"
          >
            {title}
          </h2>
          <p
            data-motion="rise"
            className="max-w-120 text-base leading-[1.5] text-cream"
          >
            {subtitle}
          </p>
        </div>

        <div data-motion="rise" className="w-full max-w-120" aria-live="polite">
          {done ? (
            <p className="rounded-full border border-white/20 bg-white/8 px-6 py-4.5 text-[15.5px] leading-[1.5] text-cream">
              {success}
            </p>
          ) : (
            <form
              onSubmit={(event) => {
                event.preventDefault()
                const form = event.currentTarget
                if (form.checkValidity() && !pending) void submit(form)
              }}
              className="flex items-center gap-3 rounded-full border border-white/20 bg-white/8 py-1.5 pr-1.5 pl-6 transition-colors focus-within:border-white/45"
            >
              <label htmlFor={`${id}-email`} className="sr-only">
                {emailLabel}
              </label>
              <input
                id={`${id}-email`}
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-[15.5px] leading-[1.5] text-cream outline-none placeholder:text-cream/60"
              />
              <div
                aria-hidden="true"
                className="absolute -left-[9999px] h-px w-px overflow-hidden"
              >
                <input
                  type="text"
                  name="website"
                  tabIndex={-1}
                  autoComplete="off"
                  defaultValue=""
                />
              </div>
              <button
                type="submit"
                disabled={pending}
                aria-busy={pending}
                data-magnetic
                className="shrink-0 cursor-pointer rounded-full bg-clay px-6.5 py-3.75 text-[15px] leading-[1.5] font-semibold text-cream transition-colors hover:bg-clay/90 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none disabled:cursor-wait disabled:opacity-70"
              >
                {button}
              </button>
            </form>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm text-cream">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
