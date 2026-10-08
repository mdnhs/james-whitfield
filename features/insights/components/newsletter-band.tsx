"use client"

import Image from "next/image"
import { useState } from "react"

import { EnterpriseBackdrop } from "@/features/enterprise/components/enterprise-backdrop"
import enterpriseBg from "@/public/images/enterprise/enterprise-bg.png"
import { NEWSLETTER } from "../data/articles"

// Monthly letter sign-up. There is no mailing-list service wired up yet, so a
// valid address just confirms in place; hook the submit up to the provider
// when one is chosen.
export function NewsletterBand() {
  const { eyebrow, title, subtitle, placeholder, submit, success } = NEWSLETTER
  const [done, setDone] = useState(false)

  return (
    <section
      id="newsletter"
      aria-labelledby="newsletter-heading"
      className="relative flex min-h-145 items-center overflow-clip py-20"
    >
      <EnterpriseBackdrop>
        <Image
          src={enterpriseBg}
          alt=""
          fill
          sizes="100vw"
          placeholder="blur"
          className="object-cover"
        />
        <div className="absolute inset-0 bg-pine/90" />
      </EnterpriseBackdrop>

      <div className="relative mx-auto flex w-full max-w-150 flex-col items-center gap-7 px-4 text-center">
        <div className="flex flex-col items-center gap-4">
          <span
            data-motion="rise"
            className="inline-flex h-8 items-center gap-1.5 rounded-full border-[0.8px] border-[#ececec] bg-white px-3.5 text-sm leading-4.5 font-medium tracking-[-0.28px] whitespace-nowrap text-[#315d44]"
          >
            <span aria-hidden className="size-1 rounded-full bg-[#315d44]" />
            {eyebrow}
          </span>
          <h2
            id="newsletter-heading"
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
                if (event.currentTarget.checkValidity()) setDone(true)
              }}
              className="flex items-center gap-3 rounded-full border border-white/20 bg-white/8 py-1.5 pr-1.5 pl-6 transition-colors focus-within:border-white/45"
            >
              <label htmlFor="newsletter-email" className="sr-only">
                Email address
              </label>
              <input
                id="newsletter-email"
                type="email"
                name="email"
                required
                autoComplete="email"
                placeholder={placeholder}
                className="min-w-0 flex-1 bg-transparent text-[15.5px] leading-[1.5] text-cream outline-none placeholder:text-cream/60"
              />
              <button
                type="submit"
                data-magnetic
                className="shrink-0 cursor-pointer rounded-full bg-clay px-6.5 py-3.75 text-[15px] leading-[1.5] font-semibold text-cream transition-colors hover:bg-clay/90 focus-visible:ring-3 focus-visible:ring-white/40 focus-visible:outline-none"
              >
                {submit}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  )
}
