"use client"

import Image from "next/image"

import type { MediaItem } from "./queries"

type Point = { x: number; y: number }
const STEP = 0.05
const tidy = (n: number) => Math.round(Math.min(1, Math.max(0, n)) * 100) / 100

// Click the image (or use the arrow keys) to say which part must stay in
// frame when the site crops it.
export function FocalPicker({
  item,
  value,
  onChange,
  disabled = false,
}: {
  item: Pick<MediaItem, "url" | "width" | "height" | "filename">
  value: Point
  onChange(next: Point): void
  disabled?: boolean
}) {
  const percent = (n: number) => Math.round(n * 100)
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={`Focal point ${percent(value.x)}% across, ${percent(value.y)}% down. Click the image or use the arrow keys.`}
      className="relative block w-full overflow-hidden rounded-xl bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-default"
      onClick={(event) => {
        const box = event.currentTarget.getBoundingClientRect()
        if (!box.width || !box.height) return
        onChange({
          x: tidy((event.clientX - box.left) / box.width),
          y: tidy((event.clientY - box.top) / box.height),
        })
      }}
      onKeyDown={(event) => {
        const move: Record<string, Point> = {
          ArrowLeft: { x: -STEP, y: 0 },
          ArrowRight: { x: STEP, y: 0 },
          ArrowUp: { x: 0, y: -STEP },
          ArrowDown: { x: 0, y: STEP },
        }
        const delta = move[event.key]
        if (!delta) return
        event.preventDefault()
        onChange({ x: tidy(value.x + delta.x), y: tidy(value.y + delta.y) })
      }}
    >
      <Image
        src={item.url}
        alt=""
        width={item.width ?? 800}
        height={item.height ?? 600}
        sizes="(min-width: 640px) 560px, 100vw"
        className="h-auto max-h-72 w-full object-contain"
        draggable={false}
      />
      <span
        aria-hidden
        className="pointer-events-none absolute size-6 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_0_0_2px_rgb(0_0_0/0.6)]"
        style={{ left: `${value.x * 100}%`, top: `${value.y * 100}%` }}
      />
    </button>
  )
}
