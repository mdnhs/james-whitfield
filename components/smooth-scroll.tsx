"use client"

import "lenis/dist/lenis.css"

import { useEffect } from "react"
import { usePathname } from "next/navigation"
import { ReactLenis, useLenis } from "lenis/react"

import { gsap, ScrollTrigger } from "@/lib/gsap"
import { findTarget } from "@/lib/page-root"

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
      lenis.scrollTo(target, {
        offset: -20,
        duration: 1.2,
        easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
      })
      history.pushState(null, "", url.hash)
    }

    window.addEventListener("click", onClick, { capture: true })
    return () => window.removeEventListener("click", onClick, { capture: true })
  }, [lenis])

  return null
}

// A new page starts at the top. Lenis keeps its own scroll target, so without
// this it would glide back to the previous page's position. Hash links are left
// for the browser to resolve.
function RouteReset() {
  const lenis = useLenis()
  const pathname = usePathname()

  useEffect(() => {
    if (!lenis || location.hash) return
    lenis.scrollTo(0, { immediate: true, force: true })
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
        duration: 1.15,
        easing: (t: number) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
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
