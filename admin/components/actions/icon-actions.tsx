"use client"

import { PencilIcon, Trash2Icon } from "lucide-react"
import type { ComponentProps } from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

type Props = Omit<ComponentProps<typeof Button>, "children" | "size"> & {
  // What it acts on, e.g. "Edit Sleep & Rest": the accessible name and the
  // tooltip, since the button shows only its icon.
  label: string
}

// Edit and delete as icons across the admin (row actions, list items).
export function EditIconButton({ label, className, ...props }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn("text-muted-foreground hover:text-foreground", className)}
      {...props}
    >
      <PencilIcon aria-hidden />
    </Button>
  )
}

export function DeleteIconButton({ label, className, ...props }: Props) {
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon-sm"
      aria-label={label}
      title={label}
      className={cn(
        "hover:bg-danger-soft hover:text-danger text-muted-foreground",
        className
      )}
      {...props}
    >
      <Trash2Icon aria-hidden />
    </Button>
  )
}
