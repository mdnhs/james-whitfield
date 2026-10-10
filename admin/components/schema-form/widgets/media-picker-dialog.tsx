"use client"

import { useQuery } from "@tanstack/react-query"
import { FileTextIcon } from "lucide-react"
import Image from "next/image"
import { useState } from "react"

import { mediaListQuery, type MediaItem } from "@/admin/modules/media/queries"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"

export function Thumb({ item }: { item: MediaItem }) {
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

export function MediaPickerDialog({
  open,
  onOpenChange,
  onPick,
  selectedId,
}: {
  open: boolean
  onOpenChange(open: boolean): void
  onPick(item: MediaItem): void
  selectedId?: string | null
}) {
  const [q, setQ] = useState("")
  const library = useQuery({
    ...mediaListQuery({ q, type: "image" }),
    enabled: open,
  })
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
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
                  onPick(item)
                  onOpenChange(false)
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
  )
}
