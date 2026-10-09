"use client"

import { useQuery } from "@tanstack/react-query"
import { FileTextIcon, ImageIcon } from "lucide-react"
import Image from "next/image"
import { useId, useState } from "react"

import { mediaListQuery, type MediaItem } from "@/admin/modules/media/queries"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

import { WidgetShell, type WidgetProps } from "./shell"

type Ref = { mediaId: string }

function Thumb({ item }: { item: MediaItem }) {
  return item.mimeType.startsWith("image/") ? (
    <Image
      src={item.url}
      alt={item.alt}
      width={item.width ?? 160}
      height={item.height ?? 120}
      sizes="160px"
      className="aspect-[4/3] w-full rounded-lg object-cover"
      style={{ objectPosition: `${item.focalX * 100}% ${item.focalY * 100}%` }}
    />
  ) : (
    <FileTextIcon aria-hidden className="m-auto size-8" />
  )
}

export function MediaWidget({
  field,
  value,
  onChange,
  error,
}: WidgetProps<Ref | null | undefined>) {
  const id = useId()
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState("")
  const selectedId = value?.mediaId || null
  const selected = useQuery({
    ...mediaListQuery({ ids: selectedId ? [selectedId] : [] }),
    enabled: Boolean(selectedId),
  })
  const library = useQuery({
    ...mediaListQuery({ q, type: "image" }),
    enabled: open,
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
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Choose an image</DialogTitle>
          </DialogHeader>
          <Input
            aria-label="Search the library"
            placeholder="Search by name or alt text"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
          <ul className="grid max-h-[60vh] grid-cols-2 gap-3 overflow-y-auto sm:grid-cols-4">
            {(library.data?.items ?? []).map((item) => (
              <li key={item.id}>
                <button
                  type="button"
                  className="w-full rounded-xl border p-1 text-left focus-visible:ring-2 focus-visible:ring-ring"
                  aria-pressed={item.id === selectedId}
                  onClick={() => {
                    onChange({ mediaId: item.id })
                    setOpen(false)
                  }}
                >
                  <Thumb item={item} />
                  <span className="mt-1 block truncate text-xs">
                    {item.alt || item.filename}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
    </WidgetShell>
  )
}
