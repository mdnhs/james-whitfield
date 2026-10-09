"use client"

import Image from "next/image"
import { Suspense, useMemo, useRef, useState } from "react"
import { useQueryStates } from "nuqs"

import type { GlobalValue } from "@/lib/content/globals"
import type { ContactOption, PlanOption } from "@/lib/content/types"
import { fill } from "@/lib/fill"
import { cn } from "@/lib/utils"
import { contactParams } from "../lib/contact-params"

type Field = "name" | "email" | "topic" | "consent"
type Errors = Partial<Record<Field, string>>
type Copy = GlobalValue<"contactForm">

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function validate(data: FormData, messages: Copy["errors"]): Errors {
  const errors: Errors = {}
  if (!String(data.get("name") ?? "").trim()) errors.name = messages.name
  if (!EMAIL.test(String(data.get("email") ?? "").trim()))
    errors.email = messages.email
  if (!data.get("topic")) errors.topic = messages.topic
  if (!data.get("consent")) errors.consent = messages.consent
  return errors
}

const control =
  "w-full rounded-xl border border-transparent bg-surface-soft px-4 text-sm leading-[1.5] text-ink outline-none transition-colors placeholder:text-text-subtle hover:border-line focus:border-pine/40 focus:bg-white aria-invalid:border-clay/60"

function Label({
  htmlFor,
  required,
  children,
}: {
  htmlFor?: string
  required?: boolean
  children: React.ReactNode
}) {
  return (
    <label
      htmlFor={htmlFor}
      className="text-sm leading-[1.5] font-medium text-text-strong"
    >
      {children}
      {required && (
        <>
          {" "}
          <span aria-hidden className="text-clay">
            *
          </span>
        </>
      )}
    </label>
  )
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null
  return (
    <p id={id} className="text-[13px] leading-[1.4] text-clay">
      {message}
    </p>
  )
}

type Prefill = { topic?: string; format?: string; message?: string }

// Enquiry form. No email service is connected yet, so a valid submission
// confirms in place; send the FormData to the chosen provider in onSubmit.
//
// Links can pre-fill it (see contact-params). Reading the URL opts a
// prerendered page out of static HTML up to the nearest Suspense boundary, so
// the boundary sits inside the card: the card and its reveal stay static, and
// the fields prerender blank before picking up the URL on load.
export function ContactForm(props: {
  copy: Copy
  topics: ContactOption[]
  formats: ContactOption[]
  plans: PlanOption[]
}) {
  return (
    <div
      data-motion="rise"
      className="flex min-w-0 flex-1 flex-col gap-6 rounded-[28px] bg-white p-6 sm:p-12"
    >
      <Suspense fallback={<EnquiryForm {...props} prefill={{}} />}>
        <PrefilledForm {...props} />
      </Suspense>
    </div>
  )
}

type FormProps = {
  copy: Copy
  topics: ContactOption[]
  formats: ContactOption[]
  plans: PlanOption[]
}

function PrefilledForm(props: FormProps) {
  const { copy, topics, formats, plans } = props
  const params = useMemo(
    () => contactParams(topics, formats, plans),
    [topics, formats, plans]
  )
  const [{ topic, format, plan }] = useQueryStates(params)
  const chosen = plan ? plans.find((p) => p.slug === plan) : undefined
  const prefill: Prefill = {
    topic: topics.find((t) => t.slug === topic)?.label,
    format: formats.find((f) => f.slug === format)?.label,
    message: chosen
      ? fill(copy.planMessage, {
          name: chosen.name,
          price: chosen.priceLabel,
          unit: chosen.unit,
        })
      : undefined,
  }
  // Uncontrolled fields only read defaults on mount, so a new link remounts.
  return (
    <EnquiryForm
      {...props}
      key={`${topic}|${format}|${plan}`}
      prefill={prefill}
    />
  )
}

function EnquiryForm({
  copy,
  topics,
  formats,
  prefill,
}: FormProps & { prefill: Prefill }) {
  const { title, labels, placeholders, consent, button, success } = copy
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)
  const form = useRef<HTMLFormElement>(null)

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const next = validate(new FormData(event.currentTarget), copy.errors)
    setErrors(next)
    const first = Object.keys(next)[0]
    if (first) {
      form.current?.querySelector<HTMLElement>(`[name="${first}"]`)?.focus()
      return
    }
    setSent(true)
  }

  // Clear a field's message as soon as it is corrected.
  const clear = (field: Field) => {
    if (!errors[field]) return
    setErrors((current) => {
      const next = { ...current }
      delete next[field]
      return next
    })
  }

  const invalid = (field: Field) =>
    errors[field]
      ? { "aria-invalid": true, "aria-describedby": `${field}-error` }
      : {}

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 className="font-display text-[28px] leading-[1.5] font-bold text-pine [font-variation-settings:'SOFT'_0,'WONK'_1] sm:text-[32px]">
          {title}
        </h2>
        {!sent && (
          <p className="text-sm leading-[1.5] text-text-muted">
            Fields marked <span className="text-clay">*</span> are required.
          </p>
        )}
      </div>

      {sent ? (
        <div
          role="status"
          className="flex flex-col gap-3 rounded-2xl bg-stone p-8"
        >
          <p className="text-xl leading-[1.4] font-semibold text-pine">
            {success.title}
          </p>
          <p className="text-base leading-[1.6] text-text-muted">
            {success.body}
          </p>
          <button
            type="button"
            onClick={() => setSent(false)}
            className="mt-2 cursor-pointer self-start text-[15px] font-semibold text-clay hover:underline hover:underline-offset-4"
          >
            {copy.sendAnother}
          </button>
        </div>
      ) : (
        <form
          ref={form}
          noValidate
          onSubmit={onSubmit}
          className="flex flex-col gap-6"
        >
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="name" required>
                {labels.name}
              </Label>
              <input
                id="name"
                name="name"
                autoComplete="name"
                placeholder={placeholders.name}
                onChange={() => clear("name")}
                className={cn(control, "h-12")}
                {...invalid("name")}
              />
              <FieldError id="name-error" message={errors.name} />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="email" required>
                {labels.email}
              </Label>
              <input
                id="email"
                name="email"
                type="email"
                autoComplete="email"
                placeholder={placeholders.email}
                onChange={() => clear("email")}
                className={cn(control, "h-12")}
                {...invalid("email")}
              />
              <FieldError id="email-error" message={errors.email} />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="phone">{labels.phone}</Label>
              <input
                id="phone"
                name="phone"
                type="tel"
                autoComplete="tel"
                placeholder={placeholders.phone}
                className={cn(control, "h-12 text-base")}
              />
            </div>
            <div className="flex flex-col gap-2">
              <Label htmlFor="topic" required>
                {labels.topic}
              </Label>
              <div className="relative">
                <select
                  id="topic"
                  name="topic"
                  defaultValue={prefill.topic ?? ""}
                  onChange={() => clear("topic")}
                  className={cn(
                    control,
                    "h-12 cursor-pointer appearance-none pr-10 invalid:text-text-subtle"
                  )}
                  required
                  {...invalid("topic")}
                >
                  <option value="" disabled>
                    {placeholders.topic}
                  </option>
                  {topics.map((topic) => (
                    <option
                      key={topic.slug}
                      value={topic.label}
                      className="text-ink"
                    >
                      {topic.label}
                    </option>
                  ))}
                </select>
                <Image
                  src="/images/contact/icon-chevron.svg"
                  alt=""
                  width={16}
                  height={16}
                  className="pointer-events-none absolute top-1/2 right-4 -translate-y-1/2"
                />
              </div>
              <FieldError id="topic-error" message={errors.topic} />
            </div>
          </div>

          <fieldset className="flex flex-col gap-2.5">
            <legend className="mb-2.5 text-sm leading-[1.5] font-medium text-text-strong">
              {labels.format}
            </legend>
            <div className="flex flex-wrap gap-2.5">
              {formats.map((format, i) => (
                <label key={format.slug} className="cursor-pointer">
                  <input
                    type="radio"
                    name="format"
                    value={format.label}
                    defaultChecked={
                      prefill.format ? format.label === prefill.format : i === 0
                    }
                    className="peer sr-only"
                  />
                  <span className="inline-flex rounded-full border border-line bg-white px-4.5 py-2.5 text-[14.5px] leading-[1.5] font-medium text-ink-muted/60 transition-colors duration-300 peer-checked:border-pine peer-checked:bg-pine peer-checked:text-cream peer-focus-visible:ring-3 peer-focus-visible:ring-clay/50 hover:border-pine/40">
                    {format.label}
                  </span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-col gap-2">
            <Label htmlFor="message">{labels.message}</Label>
            <textarea
              id="message"
              name="message"
              rows={5}
              defaultValue={prefill.message}
              placeholder={placeholders.message}
              className={cn(control, "h-35 resize-y py-3.5")}
            />
          </div>

          <div className="flex flex-col gap-2">
            <label className="flex cursor-pointer items-start gap-3">
              <span className="relative mt-0.5 flex size-5 shrink-0">
                <input
                  type="checkbox"
                  name="consent"
                  onChange={() => clear("consent")}
                  className="peer size-5 cursor-pointer appearance-none rounded-md border-[1.5px] border-[#c9cec2] bg-white transition-colors checked:border-pine checked:bg-pine focus-visible:ring-3 focus-visible:ring-clay/50 focus-visible:outline-none aria-invalid:border-clay"
                  {...invalid("consent")}
                />
                <Image
                  src="/images/services/icon-check-light.svg"
                  alt=""
                  width={11.1571}
                  height={8.20216}
                  className="pointer-events-none absolute top-1/2 left-1/2 -translate-1/2 opacity-0 transition-opacity peer-checked:opacity-100"
                />
              </span>
              <span className="text-sm leading-[1.5] text-text-muted">
                {consent}
              </span>
            </label>
            <FieldError id="consent-error" message={errors.consent} />
          </div>

          <button
            type="submit"
            className="w-full cursor-pointer rounded-full bg-clay px-7 py-4.5 text-base leading-[1.5] font-semibold whitespace-pre text-cream transition-colors hover:bg-clay/90 focus-visible:ring-3 focus-visible:ring-clay/40 focus-visible:outline-none"
          >
            {button}
          </button>
        </form>
      )}
    </>
  )
}
