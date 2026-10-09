"use client"

import { useQuery } from "@tanstack/react-query"
import { useId, useMemo } from "react"
import { Controller, type Control, type FieldValues } from "react-hook-form"

import { pagesListQuery } from "@/admin/modules/pages/queries"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
  FieldLegend,
  FieldSet,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { FormField } from "../to-fields"

// docs/brief.md §9.4: internal pages and their section anchors are offered,
// any /path, #anchor, https:, mailto: or tel: is accepted (Href).
export function LinkWidget({
  field,
  control,
}: {
  field: FormField
  control: Control<FieldValues>
}) {
  const id = useId()
  const pages = useQuery(pagesListQuery())
  const suggestions = useMemo(
    () =>
      (pages.data?.items ?? []).flatMap((page) => [
        page.path,
        ...page.anchors
          .filter((anchor) => anchor !== "home")
          .map((anchor) => `${page.path}#${anchor}`),
      ]),
    [pages.data]
  )
  const part = (key: "label" | "href", label: string) => (
    <Controller
      name={`${field.name}.${key}`}
      control={control}
      render={({ field: input, fieldState }) => (
        <Field data-invalid={fieldState.error ? true : undefined}>
          <FieldLabel htmlFor={`${id}-${key}`}>{label}</FieldLabel>
          <Input
            id={`${id}-${key}`}
            name={input.name}
            ref={input.ref}
            value={input.value ?? ""}
            onBlur={input.onBlur}
            onChange={(event) => input.onChange(event.target.value)}
            list={key === "href" ? `${id}-pages` : undefined}
            placeholder={
              key === "href" ? "/contact, #faq or https://…" : undefined
            }
            aria-invalid={fieldState.error ? true : undefined}
            aria-describedby={
              fieldState.error ? `${id}-${key}-error` : undefined
            }
          />
          {fieldState.error ? (
            <FieldError id={`${id}-${key}-error`}>
              {fieldState.error.message}
            </FieldError>
          ) : null}
        </Field>
      )}
    />
  )
  return (
    <FieldSet>
      <FieldLegend variant="label">{field.label}</FieldLegend>
      <div className="grid gap-3 sm:grid-cols-2">
        {part("label", "Link text")}
        {part("href", "Link target")}
      </div>
      <datalist id={`${id}-pages`}>
        {suggestions.map((value) => (
          <option key={value} value={value} />
        ))}
      </datalist>
      {field.description ? (
        <FieldDescription>{field.description}</FieldDescription>
      ) : null}
    </FieldSet>
  )
}
