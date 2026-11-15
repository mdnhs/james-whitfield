"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo } from "react"
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import type * as z from "zod"

import { FORM_ACTION } from "@/admin/components/dashboard/page-header"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"

import { SectionCard } from "./section-card"
import { toFields, type FieldOverrides, type FormField } from "./to-fields"
import { FieldGrid } from "./widgets"

export type FieldBlock = {
  title?: string
  description?: string
  icon?: FormField["icon"]
  fields: FormField[]
}

// A form that names sections draws them as cards: consecutive top-level
// fields with the same `section` share one, and each other group (not behind
// an on/off switch) is a card of its own. A form with no sections is one
// plain block, as before.
export function sectionBlocks(fields: readonly FormField[]): FieldBlock[] {
  if (!fields.some((field) => field.section)) return [{ fields: [...fields] }]
  const blocks: FieldBlock[] = []
  for (const field of fields) {
    const last = blocks.at(-1)
    if (field.section) {
      if (last && last.title === field.section) {
        last.fields.push(field)
        last.description ??= field.sectionDescription
        last.icon ??= field.icon
      } else {
        blocks.push({
          title: field.section,
          description: field.sectionDescription,
          icon: field.icon,
          fields: [field],
        })
      }
    } else if (field.widget === "group" && !field.nullable) {
      blocks.push({
        title: field.label,
        description: field.description,
        icon: field.icon,
        fields: field.fields ?? [],
      })
    } else if (last && !last.title) {
      last.fields.push(field)
    } else {
      blocks.push({ fields: [field] })
    }
  }
  return blocks
}

export type SubmitResult = void | {
  formError?: string
  fieldErrors?: Record<string, string[]>
}

// docs/brief.md §9.4: the form is generated from the schema's JSON Schema
// (with x-ui hints) and validated by the same Zod schema via zodResolver.
// Server errors (e.g. an ApiError's fieldErrors) map back onto fields.
export function SchemaForm<S extends z.ZodObject>({
  schema,
  defaultValues,
  onSubmit,
  submitLabel,
  resetOnSuccess = false,
  overrides,
  onValuesChange,
  derive,
}: {
  schema: S
  defaultValues: z.input<S>
  onSubmit: (values: z.output<S>) => Promise<SubmitResult> | SubmitResult
  submitLabel: string
  resetOnSuccess?: boolean
  overrides?: FieldOverrides
  // Called on every change, for live previews next to the form.
  onValuesChange?: (values: z.input<S>) => void
  // Fills one field from another as it is typed (a slug from the title)
  // until the person edits the target themselves.
  derive?: { from: string; to: string; transform: (value: string) => string }
}) {
  const fields = useMemo(() => toFields(schema, overrides), [schema, overrides])
  const form = useForm<FieldValues, unknown, FieldValues>({
    resolver: zodResolver(
      schema as unknown as z.ZodType<FieldValues, FieldValues>
    ) as Resolver<FieldValues, unknown, FieldValues>,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
    mode: "onTouched",
  })

  useEffect(() => {
    if (!onValuesChange) return
    // eslint-disable-next-line react-hooks/incompatible-library
    const sub = form.watch((values) => onValuesChange(values as z.input<S>))
    return () => sub.unsubscribe()
  }, [form, onValuesChange])

  useEffect(() => {
    if (!derive) return
    // Typed by the person (type "change"), not set by us: stop following.
    let edited = false
    const sub = form.watch((values, { name, type }) => {
      if (name === derive.to && type === "change") edited = true
      if (name !== derive.from || edited) return
      form.setValue(
        derive.to,
        derive.transform(String(values[derive.from] ?? ""))
      )
    })
    return () => sub.unsubscribe()
  }, [form, derive])

  const blocks = useMemo(() => sectionBlocks(fields), [fields])

  const submit = form.handleSubmit(async (values) => {
    let result: SubmitResult
    try {
      result = await onSubmit(values as z.output<S>)
    } catch (error) {
      // A bug or an unexpected failure must not look like a silent no-op.
      console.error("SchemaForm onSubmit failed", error)
      result = { formError: "Something went wrong. Try again." }
    }
    if (result?.fieldErrors) {
      for (const [name, messages] of Object.entries(result.fieldErrors)) {
        if (messages[0]) form.setError(name, { message: messages[0] })
      }
    }
    if (result?.formError) form.setError("root", { message: result.formError })
    if (!result && resetOnSuccess) form.reset(defaultValues as FieldValues)
  })

  const rootError = form.formState.errors.root?.message
  const pending = form.formState.isSubmitting

  return (
    <form onSubmit={submit} noValidate className="flex flex-col gap-6">
      {blocks.map((block, index) =>
        block.title ? (
          <SectionCard
            key={`${block.title}-${index}`}
            title={block.title}
            description={block.description}
            icon={block.icon}
          >
            <FieldGrid fields={block.fields} control={form.control} />
          </SectionCard>
        ) : (
          <FieldGrid
            key={`plain-${index}`}
            fields={block.fields}
            control={form.control}
          />
        )
      )}
      {rootError ? (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      ) : null}
      <div>
        <Button type="submit" disabled={pending} className={FORM_ACTION}>
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
