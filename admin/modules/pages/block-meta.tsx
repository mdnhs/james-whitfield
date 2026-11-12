"use client"

import { useId } from "react"

import type { DraftBlock } from "@/blocks/page"
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

import type { BlockMetaPatch } from "./builder-state"

// The block's rail label; its place on the page is fixed.
export function BlockMeta({
  block,
  readOnly,
  onChange,
}: {
  block: DraftBlock
  readOnly: boolean
  onChange(patch: BlockMetaPatch): void
}) {
  const id = useId()
  return (
    <FieldGroup className="gap-5">
      <Field>
        <FieldLabel htmlFor={`${id}-chapter`}>Journey rail label</FieldLabel>
        <Input
          id={`${id}-chapter`}
          value={block.chapter ?? ""}
          maxLength={24}
          disabled={readOnly}
          aria-describedby={`${id}-chapter-help`}
          onChange={(event) =>
            onChange({ chapter: event.target.value || null })
          }
        />
        <FieldDescription id={`${id}-chapter-help`}>
          Empty keeps this section out of the rail.
        </FieldDescription>
      </Field>
    </FieldGroup>
  )
}
