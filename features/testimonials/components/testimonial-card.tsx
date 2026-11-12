import { MediaImage } from "@/components/media-image"
import type { TestimonialView } from "@/lib/content/types"

export function TestimonialCard({ item }: { item: TestimonialView }) {
  const { quote, name, role, avatar } = item
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
        <MediaImage
          media={avatar}
          alt=""
          width={60}
          height={60}
          className="size-11 shrink-0 rounded-full sm:size-15"
        />
        <span className="flex flex-col">
          <span className="text-[17px] leading-6 font-semibold text-pine sm:text-xl sm:leading-7.5 sm:font-normal sm:text-ink">
            {name}
          </span>
          <span className="text-[13px] leading-4.75 text-[#686561] sm:text-base sm:leading-6 sm:text-ink sm:opacity-60">
            {role}
          </span>
        </span>
      </figcaption>
    </figure>
  )
}
