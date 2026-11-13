"use client"

import { useQuery } from "@tanstack/react-query"
import { ImageIcon, ImagePlusIcon } from "lucide-react"
import { useId, useState } from "react"

import { DeleteIconButton } from "@/admin/components/actions/icon-actions"
import { IconTip } from "@/admin/components/actions/icon-tip"
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
        {/* Icons beside the thumbnail. The pick button is named by the
            field's label (htmlFor); the tooltip says what it does. */}
        <div className="flex flex-col gap-1.5">
          <IconTip label={current ? "Change image" : "Choose image"}>
            <Button
              id={id}
              aria-invalid={error ? true : undefined}
              aria-describedby={describedBy(id, field, error)}
              type="button"
              variant="outline"
              size="icon"
              onClick={() => setOpen(true)}
            >
              {current ? (
                <ImageIcon aria-hidden />
              ) : (
                <ImagePlusIcon aria-hidden />
              )}
            </Button>
          </IconTip>
          {field.nullable && current ? (
            <DeleteIconButton
              label="Remove image"
              onClick={() => onChange(null)}
            />
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
