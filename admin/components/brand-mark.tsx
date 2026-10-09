import Image from "next/image"

import { cn } from "@/lib/utils"

// The site's logo mark with the client's name, sized for admin chrome.
export function BrandMark({
  tone = "default",
  className,
}: {
  tone?: "default" | "inverse"
  className?: string
}) {
  const inverse = tone === "inverse"
  return (
    <span className={cn("flex items-center gap-3", className)}>
      <span
        className={cn(
          "flex size-10 shrink-0 items-center justify-center rounded-full",
          inverse ? "bg-white/90" : "bg-accent"
        )}
      >
        <Image src="/images/hero/logo-mark.svg" alt="" width={22} height={22} />
      </span>
      <span className="flex items-center gap-2">
        <span className="text-base font-semibold tracking-tight">
          Magda Kennedy
        </span>
        <span
          className={cn(
            "rounded-full px-2 py-0.5 text-[11px] font-semibold tracking-wide uppercase",
            inverse
              ? "bg-white/15 text-white"
              : "bg-accent text-accent-foreground"
          )}
        >
          Admin
        </span>
      </span>
    </span>
  )
}
