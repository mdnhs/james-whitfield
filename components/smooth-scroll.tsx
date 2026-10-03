"use client"

import "lenis/dist/lenis.css"

import { useEffect } from "react"
import { ReactLenis, useLenis } from "lenis/react"

import { gsap, ScrollTrigger } from "@/lib/gsap"

// Same-page "#hash" links scroll through Lenis. Runs in the capture phase so it
// cancels the click before next/link performs its instant jump.
function AnchorScroll() {
  const lenis = useLenis()

  useEffect(() => {
    if (!lenis) return

    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0) return
      if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return

      const link = (event.target as Element | null)?.closest?.("a[href*='#']")
      if (!(link instanceof HTMLAnchorElement) || link.target === "_blank") return

      const url = new URL(link.href)
      if (url.origin !== location.origin || url.pathname !== location.pathname) return

      const target = url.hash && document.getElementById(decodeURIComponent(url.hash.slice(1)))
      if (!target) return

      event.preventDefault()
      lenis.scrollTo(target)
      history.pushState(null, "", url.hash)
    }

    window.addEventListener("click", onClick, { capture: true })
    return () => window.removeEventListener("click", onClick, { capture: true })
  }, [lenis])

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

export function SmoothScroll() {
  return (
    <ReactLenis root options={{ autoRaf: false }}>
      <GsapSync />
      <AnchorScroll />
    </ReactLenis>
  )
}
