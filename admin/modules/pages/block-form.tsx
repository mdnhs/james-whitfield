"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useRef } from "react"
import { useForm, type FieldValues, type Resolver } from "react-hook-form"
import type * as z from "zod"

import { toFields } from "@/admin/components/schema-form/to-fields"
import { FieldWidget } from "@/admin/components/schema-form/widgets"
import type { DraftBlock } from "@/blocks/page"
import { BLOCK_BY_TYPE } from "@/blocks/registry"
import { FieldGroup } from "@/components/ui/field"

import { BLOCK_FIELD_UI } from "./block-ui"

// A live form: every change goes to the builder (and so to autosave), valid
// or not; errors show inline and publish re-checks on the server. Keyed by
// block id by the caller, so switching blocks starts a fresh form.
export function BlockForm({
  block,
  errors,
  readOnly,
  onChange,
}: {
  block: DraftBlock
  errors?: Record<string, string[]>
  readOnly: boolean
  onChange(data: Record<string, unknown>): void
}) {
  const def = BLOCK_BY_TYPE[block.type]
  const overrides = BLOCK_FIELD_UI[block.type]
  const fields = useMemo(
    () => toFields(def.schema, overrides),
    [def, overrides]
  )
  const form = useForm<FieldValues, unknown, FieldValues>({
    resolver: zodResolver(
      def.schema as unknown as z.ZodType<FieldValues, FieldValues>
    ) as Resolver<FieldValues, unknown, FieldValues>,
    defaultValues: block.data,
    mode: "onChange",
  })
  useEffect(() => {
    void form.trigger()
  }, [form])
  // Validation runs (trigger, setError) notify too: only a real change of
  // the values reaches the builder, so selecting a block never autosaves.
  const last = useRef(JSON.stringify(block.data))
  useEffect(
    () =>
      form.subscribe({
        formState: { values: true },
        callback: ({ values }) => {
          const json = JSON.stringify(values)
          if (json === last.current) return
          last.current = json
          onChange(JSON.parse(json) as Record<string, unknown>)
        },
      }),
    [form, onChange]
  )
  useEffect(() => {
    for (const [name, messages] of Object.entries(errors ?? {})) {
      if (!name.startsWith("$") && messages[0])
        form.setError(name, { type: "server", message: messages[0] })
    }
  }, [errors, form])
  return (
    <fieldset disabled={readOnly} className="min-w-0">
      <legend className="sr-only">{def.label}</legend>
      <FieldGroup>
        {fields.map((field) => (
          <FieldWidget key={field.name} field={field} control={form.control} />
        ))}
      </FieldGroup>
    </fieldset>
  )
}
