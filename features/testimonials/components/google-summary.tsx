import { ExternalLink } from "lucide-react"

import type { BlockView } from "@/blocks/media-refs"

import { GoogleG } from "./google-g"
import { Stars } from "./stars"

type Props = {
  show: BlockView<"testimonials">["show"]
  google: BlockView<"testimonials">["google"]
}

const pill =
  "inline-flex items-center gap-1.5 rounded-full border border-pine/25 px-3.5 py-1.5 text-sm leading-5 font-medium text-pine transition-colors hover:bg-pine hover:text-cream"

// Hand-entered Google rating summary under the section title.
export function GoogleSummary({ show, google }: Props) {
  if (show === "site" || google.rating == null) return null
  const { rating, count, profileUrl, writeUrl } = google

  return (
    <div
      data-motion="rise"
      className="flex flex-wrap items-center gap-x-3 gap-y-2 text-ink sm:justify-center"
    >
      <span className="inline-flex items-center gap-2">
        <GoogleG className="size-5" label="Google" />
        <span className="text-lg leading-6 font-semibold">
          {rating.toFixed(1)}
        </span>
        <span role="img" aria-label={`Rated ${rating.toFixed(1)} out of 5`}>
          <Stars value={rating} />
        </span>
      </span>
      {count != null && (
        <span className="text-base leading-6 opacity-70">
          · {count} Google reviews
        </span>
      )}
      {(profileUrl || writeUrl) && (
        <span className="flex flex-wrap gap-2">
          {profileUrl && (
            <a
              href={profileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={pill}
            >
              See all on Google
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
          {writeUrl && (
            <a
              href={writeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className={pill}
            >
              Write a review
              <ExternalLink aria-hidden className="size-3.5" />
            </a>
          )}
        </span>
      )}
    </div>
  )
}
