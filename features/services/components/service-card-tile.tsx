import Link from "next/link"

import { Icon } from "@/components/icons/icon"
import type { IconName } from "@/lib/icons"

// One service card, as the Services grid shows it. The admin's live preview
// renders the same tile, so what an editor sees is what visitors get.
export function ServiceCardTile({
  icon,
  title,
  body,
  href,
  moreLabel,
}: {
  icon: IconName
  title: string
  body: string
  // The service's live page; a card without one has no link.
  href: string | null
  moreLabel: string
}) {
  return (
    <li
      data-motion="deal tilt"
      data-tilt="4"
      // Mobile: icon on the left, copy and link stacked beside it;
      // sm+: everything in one column.
      className="group relative grid grid-cols-[auto_1fr] items-start gap-x-3.5 overflow-clip rounded-[20px] bg-stone px-4 py-4.5 transition-shadow duration-500 hover:shadow-[0_24px_48px_-24px_rgba(30,79,80,0.25)] sm:flex sm:flex-col sm:gap-5 sm:bg-white sm:p-8"
    >
      <span className="row-span-2 flex rounded-[13px] bg-mist p-3.25 transition-colors duration-500 group-hover:bg-brand-mint sm:rounded-[14px] sm:p-3.5">
        <Icon name={icon} className="text-pine" />
      </span>
      <div className="flex flex-col gap-1 sm:gap-3">
        <h3 className="font-geist text-[17px] leading-6 font-semibold text-pine sm:text-2xl sm:leading-[1.3] sm:text-text-strong">
          {title}
        </h3>
        <p className="text-[13px] leading-4.75 text-ink-muted sm:text-[15.5px] sm:leading-[1.65] sm:text-text-muted">
          {body}
        </p>
      </div>
      {/* The link covers the card so the whole tile is clickable. */}
      {href ? (
        <Link
          href={href}
          aria-label={`${moreLabel.replace("→", "").trim()} about ${title}`}
          className="col-start-2 pt-2.5 text-[13px] leading-4.75 font-semibold whitespace-pre text-clay outline-none after:absolute after:inset-0 after:rounded-[20px] focus-visible:after:ring-3 focus-visible:after:ring-clay/50 sm:pt-0 sm:text-[15px] sm:leading-[1.5]"
        >
          <span className="inline-block transition-transform duration-500 ease-out group-hover:translate-x-1">
            {moreLabel}
          </span>
        </Link>
      ) : null}
    </li>
  )
}
