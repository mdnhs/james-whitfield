import { cn } from "@/lib/utils"

// Decorative pagination for mobile swipe rails: the active dot stretches into
// a terracotta pill. Hidden from assistive tech; the slides carry the labels.
export function CarouselDots({
  count,
  active,
  tone = "onLight",
  className,
}: {
  count: number
  active: number
  tone?: "onLight" | "onDark"
  className?: string
}) {
  return (
    <div aria-hidden className={cn("flex justify-center gap-1.5", className)}>
      {Array.from({ length: count }, (_, i) => (
        <span
          key={i}
          className={cn(
            "h-1.5 rounded-[3px] transition-[width,background-color] duration-300",
            i === active
              ? "w-5 bg-clay"
              : cn("w-1.5", tone === "onDark" ? "bg-white/35" : "bg-pine/20")
          )}
        />
      ))}
    </div>
  )
}
