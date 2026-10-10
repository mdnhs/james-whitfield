"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon } from "lucide-react"
import { useId, useState } from "react"

import { mediaListQuery } from "@/admin/modules/media/queries"
import { Button } from "@/components/ui/button"

import { MediaPickerDialog, Thumb } from "./media-picker-dialog"
import { describedBy, WidgetShell, type WidgetProps } from "./shell"

type Ref = { mediaId: string }

export function MediaWidget({
  field,
  value,
  onChange,
  error,
}: WidgetProps<Ref | null | undefined>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const selectedId = value?.mediaId || null
  const selected = useQuery({
    ...mediaListQuery({ ids: selectedId ? [selectedId] : [] }),
    enabled: Boolean(selectedId),
  })
  const current = selected.data?.items[0]
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div className="flex items-center gap-3">
        <div className="flex size-20 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted">
          {current ? (
            <Thumb item={current} />
          ) : (
            <ImageIcon aria-hidden className="size-6 text-muted-foreground" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <Button
            id={id}
            aria-invalid={error ? true : undefined}
            aria-describedby={describedBy(id, field, error)}
            type="button"
            variant="outline"
            onClick={() => setOpen(true)}
          >
            {current ? "Change image" : "Choose image"}
          </Button>
          {field.nullable && current ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onChange(null)}
            >
              Remove
            </Button>
          ) : null}
        </div>
      </div>
      <MediaPickerDialog
        open={open}
        onOpenChange={setOpen}
        onPick={(item) => onChange({ mediaId: item.id })}
        selectedId={selectedId}
      />
    </WidgetShell>
  )
}
