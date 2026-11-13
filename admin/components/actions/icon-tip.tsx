"use client"

import { InfoIcon } from "lucide-react"
import type { ReactElement } from "react"

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip"
import { cn } from "@/lib/utils"

// A tooltip naming an icon button (or a button whose words hide on small
// screens). The trigger keeps its own accessible name; this only shows it
// on hover and focus. `hideAt` drops the tooltip where the words show.
export function IconTip({
  label,
  children,
  hideAt,
}: {
  label: React.ReactNode
  children: ReactElement
  hideAt?: "sm" | "xl"
}) {
  return (
    <Tooltip>
      <TooltipTrigger render={children} />
      <TooltipContent
        className={cn(
          hideAt === "sm" && "sm:hidden",
          hideAt === "xl" && "xl:hidden"
        )}
      >
        {label}
      </TooltipContent>
    </Tooltip>
  )
}

// A field's help text behind a small info icon next to its label. The text
// stays in the DOM (visually hidden) under `id`, so a control's
// aria-describedby still reads it, and it is the icon's own description;
// the tooltip shows it on hover and on keyboard focus.
export function InfoHint({
  id,
  children,
  className,
}: {
  id: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <>
      <Tooltip>
        <TooltipTrigger
          render={
            <button
              type="button"
              aria-label="More info"
              aria-describedby={id}
              className={cn(
                "inline-flex size-5 shrink-0 items-center justify-center rounded-full text-muted-foreground outline-none hover:text-foreground focus-visible:ring-[3px] focus-visible:ring-ring/50",
                className
              )}
            />
          }
        >
          <InfoIcon aria-hidden className="size-3.5" />
        </TooltipTrigger>
        <TooltipContent>{children}</TooltipContent>
      </Tooltip>
      <span id={id} className="sr-only">
        {children}
      </span>
    </>
  )
}
