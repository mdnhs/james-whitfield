"use client"

import type { Editor } from "@tiptap/react"
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ImageIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
} from "lucide-react"
import { useId, useState } from "react"

import { Href } from "@/blocks/fields"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"

export function RichTextToolbar({
  editor,
  onImage,
}: {
  editor: Editor
  onImage?: () => void
}) {
  const [href, setHref] = useState<string | null>(null)
  const [linkError, setLinkError] = useState<string | null>(null)
  const errorId = useId()
  const chain = () => editor.chain().focus()
  const apply = () => {
    if (href === null) return
    if (href === "") chain().unsetLink().run()
    else if (Href.safeParse(href).success)
      chain().extendMarkRange("link").setLink({ href }).run()
    else {
      setLinkError("Use /path, #anchor, https://, mailto: or tel:")
      return
    }
    setLinkError(null)
    setHref(null)
  }
  const mark = (
    label: string,
    Icon: typeof BoldIcon,
    active: boolean,
    run: () => void
  ) => (
    <Toggle size="sm" aria-label={label} pressed={active} onPressedChange={run}>
      <Icon aria-hidden />
    </Toggle>
  )
  return (
    <div className="flex flex-wrap items-center gap-1 border-b p-1">
      {mark("Bold", BoldIcon, editor.isActive("bold"), () =>
        chain().toggleBold().run()
      )}
      {mark("Italic", ItalicIcon, editor.isActive("italic"), () =>
        chain().toggleItalic().run()
      )}
      {mark(
        "Heading 2",
        Heading2Icon,
        editor.isActive("heading", { level: 2 }),
        () => chain().toggleHeading({ level: 2 }).run()
      )}
      {mark(
        "Heading 3",
        Heading3Icon,
        editor.isActive("heading", { level: 3 }),
        () => chain().toggleHeading({ level: 3 }).run()
      )}
      {mark("Bullet list", ListIcon, editor.isActive("bulletList"), () =>
        chain().toggleBulletList().run()
      )}
      {mark("Quote", QuoteIcon, editor.isActive("blockquote"), () =>
        chain().toggleBlockquote().run()
      )}
      {mark("Link", LinkIcon, editor.isActive("link"), () =>
        setHref(editor.getAttributes("link").href ?? "")
      )}
      {onImage ? (
        <Button
          type="button"
          size="sm"
          variant="ghost"
          aria-label="Image"
          onClick={onImage}
        >
          <ImageIcon aria-hidden />
        </Button>
      ) : null}
      {href !== null ? (
        // Not a <form>: this sits inside the SchemaForm's form.
        <div className="flex items-center gap-1">
          <Input
            aria-label="Link target"
            className="h-8 w-56"
            value={href}
            onChange={(e) => {
              setHref(e.target.value)
              setLinkError(null)
            }}
            // Enter confirms the link; it must not submit the surrounding form.
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault()
                apply()
              }
            }}
            placeholder="/contact or https://…"
            aria-invalid={linkError ? true : undefined}
            aria-describedby={linkError ? errorId : undefined}
          />
          <Button type="button" size="sm" variant="outline" onClick={apply}>
            Apply
          </Button>
          {linkError ? (
            <span
              id={errorId}
              role="alert"
              className="text-xs text-destructive"
            >
              {linkError}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
