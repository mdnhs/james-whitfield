"use client"

import "lenis/dist/lenis.css"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import type Lenis from "lenis"
import { ReactLenis, useLenis } from "lenis/react"

import { gsap, ScrollTrigger } from "@/lib/gsap"
import { findTarget, flowTop } from "@/lib/page-root"

// Eases in and out, so a button-led glide neither jerks off the mark nor
// brakes hard at the end (expo-out starts at full speed, which reads as a
// shove). Longer trips take a little longer, within bounds.
const glideEase = (t: number) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2

export function glideTo(lenis: Lenis, target: HTMLElement | 0, offset = 0) {
  const top = target === 0 ? 0 : Math.max(0, flowTop(target) + offset)
  const distance = Math.abs(top - lenis.animatedScroll)
  lenis.scrollTo(top, {
    duration: Math.min(2.2, Math.max(0.9, 0.7 + distance / 3000)),
    easing: glideEase,
    force: true,
  })
}

// Same-page "#hash" links scroll through Lenis. Runs in the capture phase so it
// cancels the click before next/link performs its instant jump.
function AnchorScroll() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey)
        return

      const link = (event.target as Element | null)?.closest?.("a[href*='#']")
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank")
        return

      const url = new URL(link.href)
      if (url.origin !== location.origin || url.pathname !== location.pathname)
        return

      const target =
        url.hash && findTarget(decodeURIComponent(url.hash.slice(1)), link)
      if (!target) return

      event.preventDefault()
      glideTo(lenis, target, -20)
      history.pushState(null, "", url.hash)
    }

    window.addEventListener("click", onClick, { capture: true })
    return () => window.removeEventListener("click", onClick, { capture: true })
  }, [lenis])

  return null
}

// A new page starts at the top. Lenis keeps its own scroll target, so without
// this it would glide back to the previous page's position. A page opened at a
// #hash (a button on another page) starts at the top too, then glides down to
// its section, measured in the flow so a stuck card is not mistaken for it.
function RouteReset() {
  const lenis = useLenis()
  const pathname = usePathname()

  useEffect(() => {
    if (!lenis) return
    lenis.scrollTo(0, { immediate: true, force: true })
    const id = decodeURIComponent(location.hash.slice(1))
    if (!id) return
    // Wait a frame so the new page is laid out and its sticky cards placed.
    const frame = requestAnimationFrame(() => {
      const target = findTarget(id)
      if (target) glideTo(lenis, target, -20)
    })
    return () => cancelAnimationFrame(frame)
  }, [lenis, pathname])

  return null
}

// GSAP's ticker drives Lenis so ScrollTrigger reads the same scroll position
// on every frame.
function GsapSync() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    const tick = (time: number) => lenis.raf(time * 1000)
    lenis.on("scroll", ScrollTrigger.update)
    gsap.ticker.add(tick)
    gsap.ticker.lagSmoothing(0)

    return () => {
      lenis.off("scroll", ScrollTrigger.update)
      gsap.ticker.remove(tick)
    }
  }, [lenis])

  return null
}

// Wraps the app so client components can reach the instance via useLenis().
export function SmoothScroll({ children }: { children: React.ReactNode }) {
  return (
    <ReactLenis
      root
      options={{
        autoRaf: false,
        // Lerp, not duration: a duration restarts its easing curve on every
        // wheel event, so a trackpad's stream of small deltas lurches. Lerp
        // eases continuously toward the latest target.
        lerp: 0.085,
        wheelMultiplier: 1.0,
        touchMultiplier: 1.5,
        smoothWheel: true,
      }}
    >
      <GsapSync />
      <AnchorScroll />
      <RouteReset />
      {children}
    </ReactLenis>
  )
}
