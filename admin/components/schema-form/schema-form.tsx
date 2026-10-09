"use client"

import { zodResolver } from "@hookform/resolvers/zod"
import { useMemo } from "react"
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Resolver,
} from "react-hook-form"
import type * as z from "zod"

import { Button } from "@/components/ui/button"
import { FieldGroup } from "@/components/ui/field"
import { Spinner } from "@/components/ui/spinner"

import { toFields } from "./to-fields"
import { FieldWidget } from "./widgets"

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
}: {
  schema: S
  defaultValues: z.input<S>
  onSubmit: (values: z.output<S>) => Promise<SubmitResult> | SubmitResult
  submitLabel: string
  resetOnSuccess?: boolean
}) {
  const fields = useMemo(() => toFields(schema), [schema])
  const form = useForm<FieldValues, unknown, FieldValues>({
    resolver: zodResolver(
      schema as unknown as z.ZodType<FieldValues, FieldValues>
    ) as Resolver<FieldValues, unknown, FieldValues>,
    defaultValues: defaultValues as DefaultValues<FieldValues>,
    mode: "onTouched",
  })

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
      <FieldGroup>
        {fields.map((field) => (
          <FieldWidget key={field.name} field={field} control={form.control} />
        ))}
      </FieldGroup>
      {rootError ? (
        <p role="alert" className="text-sm text-destructive">
          {rootError}
        </p>
      ) : null}
      <div>
        <Button
          type="submit"
          disabled={pending}
          className="h-11 rounded-xl px-5 font-semibold"
        >
          {pending ? <Spinner data-icon="inline-start" /> : null}
          {submitLabel}
        </Button>
      </div>
    </form>
  )
}
