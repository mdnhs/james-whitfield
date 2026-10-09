import { cn } from "@/lib/utils"

// One card in the page's scroll stack. Server-rendered and inert on its own;
// ScrollMotion finds [data-stack] and, when motion is allowed, makes each card
// stick while the next one slides over it, scaling back and dimming the covered
// card through the shade layer. Without motion the cards are plain sections.
export function StackCard({
  children,
  id,
  className,
  rounded = true,
  last = false,
}: {
  children: React.ReactNode
  id?: string
  className?: string
  // Round the top corners the next card slides in with. Off for the first card,
  // which sits flush at the page top and only rounds as it sinks back.
  rounded?: boolean
  // The final card scrolls away normally instead of sticking.
  last?: boolean
}) {
  return (
    <div
      id={id}
      data-stack={last ? "last" : ""}
      data-stack-flat={rounded ? undefined : ""}
      className={cn(
        "relative overflow-clip",
        rounded && "rounded-t-4xl",
        className
      )}
    >
      {children}
      <div
        aria-hidden
        data-stack-shade
        className="pointer-events-none absolute inset-0 z-50 bg-black opacity-0"
      />
    </div>
  )
}
