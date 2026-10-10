"use client"

import { EditorContent, useEditor } from "@tiptap/react"
import { useEffect, useId, useRef } from "react"

import { RichTextDoc } from "@/blocks/rich-text"
import { richTextStarterKit } from "@/lib/rich-text/extensions"

import { RichTextToolbar } from "./rich-text-toolbar"
import { describedBy, WidgetShell, type WidgetProps } from "./shell"

const EMPTY = { type: "doc", content: [{ type: "paragraph" }] }

const extensions = [richTextStarterKit]

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
        {editor ? <RichTextToolbar editor={editor} /> : null}
        <EditorContent editor={editor} />
      </div>
    </WidgetShell>
  )
}
