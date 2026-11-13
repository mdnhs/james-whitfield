import { MediaImage } from "@/components/media-image"
import { ExternalLink } from "lucide-react"

import type { TestimonialView } from "@/lib/content/types"

import { GoogleG } from "./google-g"
import { Stars } from "./stars"

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("")

export function TestimonialCard({ item }: { item: TestimonialView }) {
  const { quote, name, role, avatar, source, rating, reviewUrl } = item
  const google = source === "google"
  // Mobile shows a large glyph instead of inline marks, so strip any the
  // editor typed; desktop puts them back around the text.
  const text = quote
    .trim()
    .replace(/^[“"]\s*/, "")
    .replace(/\s*[”"]$/, "")
  const quoted = text !== quote.trim()

  return (
    <figure
      data-motion="deal tilt"
      data-tilt="4"
      className="relative flex min-h-89 flex-col gap-6 rounded-[20px] bg-white px-5.5 py-6 text-ink shadow-[0_8px_12px_rgba(31,79,79,0.08)] sm:min-h-0 sm:gap-[42px] sm:rounded-xl sm:bg-stone sm:p-9 sm:shadow-none"
    >
      {google && (
        <GoogleG
          className="absolute top-5 right-5 size-5 sm:top-9 sm:right-9"
          label="Google review"
        />
      )}
      {google && (
        <span
          role="img"
          aria-label={`Rated ${rating} out of 5`}
          className="-mb-3 sm:-mb-6"
        >
          <Stars value={rating} className="size-5" />
        </span>
      )}
      <div className="flex flex-col gap-1 sm:block">
        <span
          aria-hidden
          className="font-display text-[40px] leading-11 font-bold tracking-[-0.5px] text-clay [font-variation-settings:'SOFT'_0,'WONK'_1] sm:hidden"
        >
          “
        </span>
        <blockquote className="text-lg leading-6.75 font-medium sm:text-xl sm:leading-7.5 sm:font-normal">
          {quoted && <span className="hidden sm:inline">“</span>}
          {text}
          {quoted && <span className="hidden sm:inline">”</span>}
        </blockquote>
      </div>
      <figcaption className="flex items-center gap-3 sm:gap-4.5">
        {avatar ? (
          <MediaImage
            media={avatar}
            alt=""
            width={60}
            height={60}
            className="size-11 shrink-0 rounded-full sm:size-15"
          />
        ) : (
          <span
            aria-hidden
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-pine font-semibold text-cream sm:size-15 sm:text-xl"
          >
            {initialsOf(name)}
          </span>
        )}
        <span className="flex flex-col">
          <span className="text-[17px] leading-6 font-semibold text-pine sm:text-xl sm:leading-7.5 sm:font-normal sm:text-ink">
            {name}
          </span>
          <span className="text-[13px] leading-4.75 text-[#686561] sm:text-base sm:leading-6 sm:text-ink sm:opacity-60">
            {role}
          </span>
          {google && reviewUrl && (
            <a
              href={reviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-[13px] leading-4.75 text-pine underline-offset-2 hover:underline sm:text-sm"
            >
              View on Google
              <ExternalLink aria-hidden className="size-3" />
            </a>
          )}
        </span>
      </figcaption>
    </figure>
  )
}
