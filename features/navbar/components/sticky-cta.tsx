"use client"

import { Phone } from "lucide-react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { useEffect, useRef, useState } from "react"

import { buttonVariants } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Booking CTAs in the page itself (hero, sections). While any is on screen
// the bar steps aside, so two "book" buttons never show at once.
const PAGE_CTAS =
  'main a[href^="/contact"], main [data-track="book_appointment"]'

// Mobile-only action bar pinned to the viewport bottom: a call button (when a
// phone number is set) beside the main booking CTA. The footer pads its
// bottom on mobile so the bar never covers its last lines.
export function StickyCta({
  cta,
  phone,
  callLabel,
}: {
  cta: { label: string; href: string }
  phone: { display: string; e164: string }
  callLabel: string
}) {
  const pathname = usePathname()
  const [covered, setCovered] = useState(true)
  const bar = useRef<HTMLDivElement>(null)

  // Publish the bar's visible height so fixed widgets (the chat launcher) can
  // ride above it: 0px while it is covered, hidden (>= sm) or unmounted.
  useEffect(() => {
    const root = document.documentElement
    const el = bar.current
    if (covered || !el) {
      root.style.setProperty("--sticky-cta-h", "0px")
      return
    }
    const write = () =>
      root.style.setProperty("--sticky-cta-h", `${el.offsetHeight}px`)
    write()
    const observer = new ResizeObserver(write)
    observer.observe(el)
    return () => {
      observer.disconnect()
      root.style.setProperty("--sticky-cta-h", "0px")
    }
  }, [covered])

  useEffect(() => {
    const targets = Array.from(document.querySelectorAll(PAGE_CTAS))
    // On screen *and* on top: the scroll stack keeps earlier cards (the hero)
    // pinned under the ones sliding over them, where their CTAs still sit
    // inside the viewport but cannot be seen.
    const visible = (el: Element) => {
      const r = el.getBoundingClientRect()
      if (r.width === 0 || r.bottom <= 0 || r.top >= innerHeight) return false
      const x = r.left + r.width / 2
      const y = Math.min(Math.max(r.top + r.height / 2, 0), innerHeight - 1)
      const hit = document.elementFromPoint(x, y)
      // An ancestor hit (a wrapper mid-animation) still means nothing covers it.
      return !!hit && (el.contains(hit) || hit.contains(el))
    }
    let frame = 0
    const check = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(() => setCovered(targets.some(visible)))
    }
    check()
    // Reveals (the hero's intro) unhide CTAs without any scroll, so poll too;
    // it is a handful of rect reads.
    const poll = setInterval(check, 400)
    addEventListener("scroll", check, { passive: true })
    addEventListener("resize", check)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(poll)
      removeEventListener("scroll", check)
      removeEventListener("resize", check)
    }
  }, [pathname])

  return (
    <div
      ref={bar}
      data-site-chrome
      inert={covered}
      aria-hidden={covered || undefined}
      className={cn(
        "fixed inset-x-0 bottom-0 z-50 flex items-center gap-2.5 bg-white px-4 pt-3 pb-[max(1.75rem,env(safe-area-inset-bottom))] shadow-[0_-4px_16px_rgba(13,38,38,0.06)] transition-transform duration-300 ease-out motion-reduce:transition-none sm:hidden",
        covered && "translate-y-full"
      )}
    >
      {phone.e164 ? (
        <a
          href={`tel:${phone.e164}`}
          aria-label={
            [callLabel, phone.display].filter(Boolean).join(" ") || undefined
          }
          className="flex size-13 shrink-0 items-center justify-center rounded-full border border-brand text-brand transition-colors hover:bg-brand/5"
        >
          <Phone aria-hidden className="size-5" />
        </a>
      ) : null}
      <Link
        href={cta.href}
        data-track="book_appointment"
        data-cta-location="sticky"
        className={cn(
          buttonVariants(),
          "h-13 min-w-0 flex-1 rounded-full bg-clay px-6 py-0 text-base leading-5 font-semibold text-cream hover:bg-clay/90"
        )}
      >
        {cta.label}
      </Link>
    </div>
  )
}
