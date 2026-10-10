"use client"

import type { JSONContent } from "@tiptap/core"
import { Placeholder } from "@tiptap/extensions"
import { EditorContent, useEditor, useEditorState } from "@tiptap/react"
import { BubbleMenu } from "@tiptap/react/menus"
import { BoldIcon, ItalicIcon, LinkIcon } from "lucide-react"
import { useEffect, useMemo, useRef, useState } from "react"

import { MediaPickerDialog } from "@/admin/components/schema-form/widgets/media-picker-dialog"
import { RichTextToolbar } from "@/admin/components/schema-form/widgets/rich-text-toolbar"
import { ArticleBodyDoc } from "@/blocks/rich-text"
import { Toggle } from "@/components/ui/toggle"
import type { ArticleDraft } from "@/lib/content/article"
import { plainText, readingMinutes } from "@/lib/content/reading-time"
import { articleExtensions } from "@/lib/rich-text/extensions"

type Body = ArticleDraft["body"]
const extensions = [
  ...articleExtensions,
  Placeholder.configure({ placeholder: "Start writing…" }),
]

// docs/brief.md §9.3: headings, lists, quote, links, images from the
// library, bubble menu, live reading time. Same sync rules as the Phase 4
// rich-text widget: our own edits come back as `emitted` and are skipped.
export function ArticleBodyEditor({
  value,
  onChange,
  readOnly,
}: {
  value: Body
  onChange(body: Body): void
  readOnly: boolean
}) {
  const emitted = useRef<unknown>(undefined)
  const [picking, setPicking] = useState(false)
  const editor = useEditor({
    extensions,
    content: value as JSONContent,
    editable: !readOnly,
    immediatelyRender: false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": "Article body",
        class: "prose max-w-none min-h-[50vh] p-4 focus:outline-none",
      },
    },
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON()
      const parsed = ArticleBodyDoc.safeParse(json)
      const next = (parsed.success ? parsed.data : json) as Body
      emitted.current = next
      onChange(next)
    },
  })
  useEffect(() => {
    if (!editor || value === emitted.current) return
    if (JSON.stringify(value) === JSON.stringify(emitted.current)) {
      emitted.current = value
      return
    }
    if (JSON.stringify(value) !== JSON.stringify(editor.getJSON()))
      editor.commands.setContent(value as JSONContent, { emitUpdate: false })
    emitted.current = value
  }, [editor, value])
  useEffect(() => {
    if (editor && editor.isEditable === readOnly)
      editor.setEditable(!readOnly, false)
  }, [editor, readOnly])
  const marks = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: !!e?.isActive("bold"),
      italic: !!e?.isActive("italic"),
      link: !!e?.isActive("link"),
    }),
  })
  const minutes = useMemo(() => readingMinutes(plainText(value)), [value])
  return (
    <div className="rounded-xl border bg-card">
      {editor && !readOnly ? (
        <RichTextToolbar editor={editor} onImage={() => setPicking(true)} />
      ) : null}
      {editor && !readOnly ? (
        <BubbleMenu
          editor={editor}
          shouldShow={({ editor: e, state }) =>
            !state.selection.empty && !e.isActive("image")
          }
        >
          <div
            role="toolbar"
            aria-label="Text formatting"
            className="flex gap-1 rounded-lg border bg-popover p-1 shadow-md"
          >
            <Toggle
              size="sm"
              aria-label="Bold"
              pressed={marks?.bold}
              onPressedChange={() => editor.chain().focus().toggleBold().run()}
            >
              <BoldIcon aria-hidden />
            </Toggle>
            <Toggle
              size="sm"
              aria-label="Italic"
              pressed={marks?.italic}
              onPressedChange={() =>
                editor.chain().focus().toggleItalic().run()
              }
            >
              <ItalicIcon aria-hidden />
            </Toggle>
            <Toggle
              size="sm"
              aria-label="Remove link"
              pressed={marks?.link}
              disabled={!marks?.link}
              onPressedChange={() =>
                editor.chain().focus().extendMarkRange("link").unsetLink().run()
              }
            >
              <LinkIcon aria-hidden />
            </Toggle>
          </div>
        </BubbleMenu>
      ) : null}
      <EditorContent editor={editor} />
      <p
        aria-live="polite"
        className="border-t px-4 py-2 text-xs text-muted-foreground"
      >
        {minutes} min read
      </p>
      <MediaPickerDialog
        open={picking}
        onOpenChange={setPicking}
        onPick={(item) =>
          editor
            ?.chain()
            .focus()
            .insertContent({
              type: "image",
              attrs: { mediaId: item.id, src: item.url, alt: item.alt ?? "" },
            })
            .run()
        }
      />
    </div>
  )
}
