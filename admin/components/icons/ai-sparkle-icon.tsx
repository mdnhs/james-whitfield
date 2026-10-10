import type { ComponentProps } from "react"

// Hugeicons "GoogleGeminiIcon" (MIT licence, © Hugeicons,
// https://github.com/hugeicons/hugeicons-react). Path copied verbatim so the
// admin needs no icon dependency for one glyph (spec §2).
export function AiSparkleIcon(props: ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M3 12C7.97056 12 12 7.97056 12 3C12 7.97056 16.0294 12 21 12C16.0294 12 12 16.0294 12 21C12 16.0294 7.97056 12 3 12Z" />
    </svg>
  )
}
