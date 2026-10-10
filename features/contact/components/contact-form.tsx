"use client"

import Image from "next/image"
import { Suspense, useEffect, useMemo, useRef, useState } from "react"
import { useQueryStates } from "nuqs"

import type { GlobalValue } from "@/lib/content/globals"
import type { ContactOption, PlanOption } from "@/lib/content/types"
import { fill } from "@/lib/fill"
import { LeadInput, type LeadSubmission } from "@/lib/leads/schema"
import { cn } from "@/lib/utils"
import { readAttribution } from "../lib/attribution"
import { contactParams } from "../lib/contact-params"
import { fetchStamp, submitLead } from "../lib/submit-lead"
import { trackLead } from "../lib/track"
import { Turnstile } from "./turnstile"

type Field = "name" | "email" | "phone" | "topic" | "message" | "consent"
type Errors = Partial<Record<Field, string>>
type Copy = GlobalValue<"contactForm">

const FIELDS: readonly string[] = [
  "name",
  "email",
  "phone",
  "topic",
  "message",
  "consent",
]

const text = (data: FormData, key: string) => String(data.get(key) ?? "")

// Same schema as the API (lib/leads/schema.ts); issues map to the form's copy.
function validate(data: FormData, messages: Copy["errors"]) {
  const result = LeadInput.safeParse({
    name: text(data, "name"),
    email: text(data, "email"),
    phone: text(data, "phone"),
    topic: text(data, "topic"),
    format: text(data, "format") || undefined,
    plan: text(data, "plan") || undefined,
    message: text(data, "message"),
    consent: data.get("consent") ? true : false,
  })
  if (result.success) return { errors: {} as Errors, input: result.data }
  const errors: Errors = {}
  for (const issue of result.error.issues) {
    const field = String(issue.path[0])
    if (FIELDS.includes(field) && !errors[field as Field])
      errors[field as Field] = messages[field as Field]
  }
  return { errors, input: null }
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

type Prefill = {
  topic?: string
  format?: string
  plan?: string
  message?: string
}

// Enquiry form. Validates client-side with the API's own schema, then POSTs to
// /api/v1/public/leads with a signed form stamp, an empty honeypot, the
// first-touch attribution and (when configured) a Turnstile token. API field
// errors are shown with this form's copy; success confirms in place.
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
  turnstileSiteKey: string | null
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
  turnstileSiteKey: string | null
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
    topic: topic ?? undefined,
    format: format ?? undefined,
    plan: plan ?? undefined,
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
  turnstileSiteKey,
  prefill,
}: FormProps & { prefill: Prefill }) {
  const { title, labels, placeholders, consent, button, success } = copy
  const [errors, setErrors] = useState<Errors>({})
  const [sent, setSent] = useState(false)
  const [formError, setFormError] = useState("")
  const [pending, setPending] = useState(false)
  const [stamp, setStamp] = useState("")
  const [token, setToken] = useState<string | null>(null)
  const [widget, setWidget] = useState(0)
  const form = useRef<HTMLFormElement>(null)

  useEffect(() => {
    void fetchStamp().then(setStamp)
  }, [])

  const focus = (name: string) =>
    form.current?.querySelector<HTMLElement>(`[name="${name}"]`)?.focus()

  const onSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (pending) return
    const data = new FormData(event.currentTarget)
    const { errors: next, input } = validate(data, copy.errors)
    setErrors(next)
    setFormError("")
    const first = Object.keys(next)[0]
    if (first || !input) {
      if (first) focus(first)
      // Only the choice fields (format, plan) failed: no input to flag, but
      // the visitor must still be told why nothing was sent.
      else setFormError(copy.errors.generic)
      return
    }
    let attribution: LeadSubmission["attribution"]
    try {
      attribution = readAttribution(window.sessionStorage)
    } catch {
      attribution = readAttribution({} as Storage)
    }
    const eventId = crypto.randomUUID()
    const payload: LeadSubmission = {
      ...input,
      eventId,
      sourcePath: window.location.pathname,
      attribution,
      stamp,
      website: text(data, "website"),
      // No token (widget blocked or not loaded) still goes through: the server
      // accepts it as a flagged lead.
      turnstileToken: token ?? undefined,
    }
    setPending(true)
    const result = await submitLead(payload)
    setPending(false)
    if (result.ok) {
      trackLead(eventId)
      setSent(true)
      return
    }
    // Turnstile tokens are single-use: get a fresh one for the next attempt.
    setToken(null)
    setWidget((n) => n + 1)
    if (result.kind === "fields") {
      const mapped: Errors = {}
      for (const key of Object.keys(result.fieldErrors)) {
        mapped[key as Field] =
          copy.errors[key as keyof Copy["errors"]] ?? copy.errors.generic
      }
      setErrors(mapped)
      const firstKey = Object.keys(mapped)[0]
      if (firstKey) focus(firstKey)
      else setFormError(copy.errors.generic)
    } else {
      setFormError(
        result.kind === "rate-limited"
          ? copy.errors.rateLimited
          : copy.errors.generic
      )
    }
  }

  const sendAnother = () => {
    setSent(false)
    setErrors({})
    setFormError("")
    setToken(null)
    setWidget((n) => n + 1)
    void fetchStamp().then(setStamp)
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
            onClick={sendAnother}
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
          className="relative flex flex-col gap-6"
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
                onChange={() => clear("phone")}
                className={cn(control, "h-12 text-base")}
                {...invalid("phone")}
              />
              <FieldError id="phone-error" message={errors.phone} />
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
                      value={topic.slug}
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
                    value={format.slug}
                    defaultChecked={
                      prefill.format ? format.slug === prefill.format : i === 0
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
              onChange={() => clear("message")}
              className={cn(control, "h-35 resize-y py-3.5")}
              {...invalid("message")}
            />
            <FieldError id="message-error" message={errors.message} />
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

          {prefill.plan && (
            <input type="hidden" name="plan" value={prefill.plan} />
          )}

          <div
            aria-hidden="true"
            className="absolute -left-[9999px] h-px w-px overflow-hidden"
          >
            <label>
              Website
              <input
                type="text"
                name="website"
                tabIndex={-1}
                autoComplete="off"
                defaultValue=""
              />
            </label>
          </div>

          {turnstileSiteKey && (
            <Turnstile
              key={widget}
              siteKey={turnstileSiteKey}
              onToken={setToken}
            />
          )}

          {formError && (
            <p role="alert" className="text-[13px] leading-[1.4] text-clay">
              {formError}
            </p>
          )}

          <button
            type="submit"
            disabled={pending}
            aria-busy={pending}
            className="w-full cursor-pointer rounded-full bg-clay px-7 py-4.5 text-base leading-[1.5] font-semibold whitespace-pre text-cream transition-colors hover:bg-clay/90 focus-visible:ring-3 focus-visible:ring-clay/40 focus-visible:outline-none disabled:opacity-70"
          >
            {button}
          </button>
        </form>
      )}
    </>
  )
}
