"use client"

import { EditorContent, useEditor, type Editor } from "@tiptap/react"
import StarterKit from "@tiptap/starter-kit"
import {
  BoldIcon,
  Heading2Icon,
  Heading3Icon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  QuoteIcon,
} from "lucide-react"
import { useId, useState } from "react"

import { Href } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"

import { WidgetShell, type WidgetProps } from "./shell"

const EMPTY = { type: "doc", content: [{ type: "paragraph" }] }

// Only what blocks/rich-text.ts renders: paragraphs, h2/h3, bullet lists,
// quotes, bold, italic and links. The site renders the JSON statically
// (docs/brief.md §15), never as HTML.
const extensions = [
  StarterKit.configure({
    heading: { levels: [2, 3] },
    code: false,
    codeBlock: false,
    strike: false,
    underline: false,
    horizontalRule: false,
    orderedList: false,
    hardBreak: false,
    link: { openOnClick: false, autolink: false },
  }),
]

function Toolbar({ editor }: { editor: Editor }) {
  const [href, setHref] = useState<string | null>(null)
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
  const chain = () => editor.chain().focus()
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
      {href !== null ? (
        // Not a <form>: this sits inside the SchemaForm's form.
        <div className="flex items-center gap-1">
          <Input
            aria-label="Link target"
            className="h-8 w-56"
            value={href}
            onChange={(e) => setHref(e.target.value)}
            placeholder="/contact or https://…"
            aria-invalid={
              href !== "" && !Href.safeParse(href).success ? true : undefined
            }
          />
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => {
              if (href === "") chain().unsetLink().run()
              else if (Href.safeParse(href).success)
                chain().extendMarkRange("link").setLink({ href }).run()
              else return
              setHref(null)
            }}
          >
            Apply
          </Button>
        </div>
      ) : null}
    </div>
  )
}

export function RichTextWidget({
  field,
  value,
  onChange,
  error,
}: WidgetProps<unknown>) {
  const id = useId()
  const editor = useEditor({
    extensions,
    content: (value as object | undefined) ?? EMPTY,
    // Server rendering has no DOM; the admin renders this on the client.
    immediatelyRender: false,
    editorProps: {
      attributes: {
        id,
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": field.label,
        class: "prose prose-sm min-h-40 max-w-none p-3 focus:outline-none",
      },
    },
    // Unknown attrs (target, rel, class) are stripped by the schema; an
    // invalid document is passed through so the form shows the error.
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON()
      const parsed = RichTextDoc.safeParse(json)
      onChange(parsed.success ? parsed.data : json)
    },
  })
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div className="rounded-xl border">
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
    </WidgetShell>
  )
}
