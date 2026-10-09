"use client"

import { useId } from "react"

import type { DraftBlock } from "@/blocks/page"
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"

import type { BlockMetaPatch } from "./builder-state"

const isHero = (type: DraftBlock["type"]) =>
  type === "hero.home" || type === "hero.page"

// The block's place on the page (section id, rail label, visibility, card
// grouping), apart from its content.
export function BlockMeta({
  block,
  first,
  errors,
  readOnly,
  onChange,
}: {
  block: DraftBlock
  first: boolean
  errors?: Record<string, string[]>
  readOnly: boolean
  onChange(patch: BlockMetaPatch): void
}) {
  const id = useId()
  const anchorError = errors?.$anchor?.[0]
  const hero = isHero(block.type)
  return (
    <FieldGroup className="gap-5">
      <div className="grid gap-5 sm:grid-cols-2">
        <Field data-invalid={anchorError ? true : undefined}>
          <FieldLabel htmlFor={`${id}-anchor`}>Section id</FieldLabel>
          <Input
            id={`${id}-anchor`}
            className="font-mono"
            value={block.anchor}
            maxLength={40}
            readOnly={hero}
            disabled={readOnly}
            aria-invalid={anchorError ? true : undefined}
            aria-describedby={`${id}-anchor-help`}
            onChange={(event) => onChange({ anchor: event.target.value })}
          />
          {anchorError ? (
            <FieldError id={`${id}-anchor-help`}>{anchorError}</FieldError>
          ) : (
            <FieldDescription id={`${id}-anchor-help`}>
              {hero
                ? "The hero is always #home."
                : `Used in links like /about#${block.anchor}`}
            </FieldDescription>
          )}
        </Field>
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
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          orientation="horizontal"
          className="rounded-xl border bg-background/40 p-3"
        >
          <Switch
            id={`${id}-hidden`}
            checked={block.hidden}
            disabled={readOnly}
            onCheckedChange={(hidden) => onChange({ hidden })}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-hidden`}>Hidden</FieldLabel>
            <FieldDescription>Kept in the draft, not shown.</FieldDescription>
          </FieldContent>
        </Field>
        <Field
          orientation="horizontal"
          className="rounded-xl border bg-background/40 p-3"
        >
          <Switch
            id={`${id}-join`}
            checked={block.joinPrevious}
            disabled={readOnly || first}
            onCheckedChange={(joinPrevious) => onChange({ joinPrevious })}
          />
          <FieldContent>
            <FieldLabel htmlFor={`${id}-join`}>
              Same card as the previous block
            </FieldLabel>
            <FieldDescription>
              {first
                ? "The first block starts the page."
                : "Shares one white card with the block above."}
            </FieldDescription>
          </FieldContent>
        </Field>
      </div>
    </FieldGroup>
  )
}
