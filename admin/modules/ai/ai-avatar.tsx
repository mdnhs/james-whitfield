// admin/modules/ai/ai-avatar.tsx
import { cn } from "cn"

import { AiSparkleIcon } from "@/admin/components/icons/ai-sparkle-icon"

// The assistant's one accent: the theme's green turning towards teal, the
// way Gemini's mark shifts hue. Built from the theme tokens, so it follows
// light and dark (and a future generated theme) without new colours.
export const AI_GRADIENT =
  "linear-gradient(135deg, var(--primary) 0%, color-mix(in oklch, var(--primary), #0891b2 50%) 55%, var(--ring) 100%)"
export const AI_LINE =
  "linear-gradient(90deg, transparent, color-mix(in oklch, var(--primary) 70%, transparent) 25%, color-mix(in oklch, var(--primary), #0891b2 50%) 60%, transparent)"

export function AiAvatar({
  size = "sm",
  className,
}: {
  size?: "sm" | "lg"
  className?: string
}) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "grid shrink-0 place-items-center rounded-full text-primary-foreground shadow-[0_0_0_3px_color-mix(in_oklch,var(--primary)_14%,transparent)]",
        size === "lg" ? "size-11" : "size-7",
        className
      )}
      style={{ backgroundImage: AI_GRADIENT }}
    >
      <AiSparkleIcon
        fill="currentColor"
        className={size === "lg" ? "size-5" : "size-3.5"}
      />
    </span>
  )
}
