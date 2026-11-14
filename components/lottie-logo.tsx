"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"

import { cn } from "@/lib/utils"

type Player = {
  destroy(): void
  goToAndStop(frame: number, isFrame: boolean): void
  addEventListener(name: "DOMLoaded", callback: () => void): void
  totalFrames: number
}

// Plays the site's Lottie logo. `children` (the still logo) shows until the
// animation has drawn, and stays if it cannot load, so the brand never
// blinks out. Reduced motion: the last frame, held still.
export function LottieLogo({
  src,
  className,
  children,
}: {
  src: string
  className?: string
  children: ReactNode
}) {
  const box = useRef<HTMLSpanElement>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    let player: Player | undefined
    let cancelled = false
    const still = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    Promise.all([
      import("lottie-web/build/player/lottie_light"),
      fetch(src).then((response) => {
        if (!response.ok) throw new Error(`lottie ${response.status}`)
        return response.json() as Promise<unknown>
      }),
    ])
      .then(([lottie, animationData]) => {
        if (cancelled || !box.current) return
        player = lottie.default.loadAnimation({
          container: box.current,
          renderer: "svg",
          loop: !still,
          autoplay: !still,
          animationData,
          rendererSettings: { preserveAspectRatio: "xMidYMid meet" },
        }) as Player
        player.addEventListener("DOMLoaded", () => {
          if (still) player?.goToAndStop(player.totalFrames - 1, true)
          if (!cancelled) setReady(true)
        })
      })
      // The still logo stays: a missing animation is not worth an error.
      .catch(() => {})
    return () => {
      cancelled = true
      player?.destroy()
      setReady(false)
    }
  }, [src])

  return (
    <span
      className={cn("relative grid shrink-0 place-items-center", className)}
    >
      <span
        ref={box}
        aria-hidden
        className={cn(
          "col-start-1 row-start-1 size-full transition-opacity duration-300",
          ready ? "opacity-100" : "opacity-0"
        )}
      />
      {ready ? null : (
        <span className="col-start-1 row-start-1 grid place-items-center">
          {children}
        </span>
      )}
    </span>
  )
}
