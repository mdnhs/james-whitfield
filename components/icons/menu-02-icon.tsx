import type { ComponentProps } from "react"

// Hugeicons "Menu02Icon" (MIT licence, © Hugeicons,
// https://github.com/hugeicons/hugeicons-react): two full bars over a short
// one, as in the mobile design. Drawn inline so the site needs no icon
// dependency for one glyph.
export function Menu02Icon(props: ComponentProps<"svg">) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      aria-hidden="true"
      {...props}
    >
      <path d="M4 7H20M4 12H20M4 17H14" />
    </svg>
  )
}
