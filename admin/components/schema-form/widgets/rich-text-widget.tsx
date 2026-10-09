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
import { useEffect, useId, useRef, useState } from "react"

import { Href } from "@/blocks/fields"
import { RichTextDoc } from "@/blocks/rich-text"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Toggle } from "@/components/ui/toggle"

import { describedBy, WidgetShell, type WidgetProps } from "./shell"

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

export function RichTextWidget({
  field,
  value,
  onChange,
  onBlur,
  error,
}: WidgetProps<unknown>) {
  const id = useId()
  const emitted = useRef<unknown>(undefined)
  const described = describedBy(id, field, error)
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
        ...(error ? { "aria-invalid": "true" } : {}),
        ...(described ? { "aria-describedby": described } : {}),
        class: "prose prose-sm min-h-40 max-w-none p-3 focus:outline-none",
      },
    },
    // Unknown attrs (target, rel, class) are stripped by the schema; an
    // invalid document is passed through so the form shows the error.
    onUpdate: ({ editor: e }) => {
      const json = e.getJSON()
      const parsed = RichTextDoc.safeParse(json)
      const next = parsed.success ? parsed.data : json
      emitted.current = next
      onChange(next)
    },
    onBlur: () => onBlur?.(),
  })
  // External changes (reset, restore, reconcile) replace the editor content;
  // the editor's own edits come back here as `emitted` and are skipped.
  // react-hook-form hands the value back as a clone (useWatch), so equal
  // JSON counts as our own edit: comparing against the editor's JSON instead
  // differs (link attrs the schema strips) and setContent throws the cursor
  // to the end.
  useEffect(() => {
    if (!editor || value === emitted.current) return
    if (JSON.stringify(value) === JSON.stringify(emitted.current)) {
      emitted.current = value
      return
    }
    const next = (value as object | undefined) ?? EMPTY
    if (JSON.stringify(next) !== JSON.stringify(editor.getJSON())) {
      editor.commands.setContent(next, { emitUpdate: false })
    }
    emitted.current = value
  }, [editor, value])
  // A read-only form wraps its fields in a disabled <fieldset>, which
  // disables inputs and buttons but not contentEditable.
  const host = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!editor) return
    const disabled = host.current?.closest("fieldset:disabled") != null
    if (editor.isEditable === disabled) editor.setEditable(!disabled, false)
  })
  return (
    <WidgetShell id={id} field={field} error={error}>
      <div ref={host} className="rounded-xl border">
        {editor ? <Toolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
    </WidgetShell>
  )
}
