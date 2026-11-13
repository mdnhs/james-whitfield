"use client"

import type { LucideIcon } from "lucide-react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

import { IconTip } from "./icon-tip"

type Props = Omit<ComponentProps<typeof Button>, "children" | "size"> & {
  // The accessible name and the tooltip: the button shows only its icon.
  label: string
  // A shorter tooltip when the name carries context (e.g. the row's title).
  tip?: string
  icon: LucideIcon
  size?: "icon-sm" | "icon" | "icon-lg"
  tone?: "default" | "danger"
}

// A secondary action as an icon with a tooltip (refresh, export, archive,
// copy, revoke…). Primary actions keep their words.
export function TipButton({
  label,
  tip,
  icon: Icon,
  size = "icon-sm",
  tone = "default",
  variant = "ghost",
  className,
  ...props
}: Props) {
  return (
    <IconTip label={tip ?? label}>
      <Button
        type="button"
        variant={variant}
        size={size}
        aria-label={label}
        className={cn(
          variant === "ghost" && "text-muted-foreground hover:text-foreground",
          tone === "danger" &&
            "hover:bg-danger-soft hover:text-danger text-muted-foreground",
          className
        )}
        {...props}
      >
        <Icon aria-hidden />
      </Button>
    </IconTip>
  )
}
