"use client"

import { useMemo } from "react"
import { toast } from "sonner"

import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { emptyValueFor } from "@/admin/components/schema-form/to-fields"
import { collectionsApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { conflictOf } from "@/admin/modules/pages/use-autosave"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  COLLECTION_SCHEMAS,
  type CollectionSlug,
} from "@/lib/content/collections"
import { slugify } from "@/lib/utils"

import { COLLECTION_FIELD_UI, ITEM_NOUN } from "./collection-ui"

export type EditableItem = {
  id: string
  version: number
  values: Record<string, unknown>
}

// A slug follows its title (or name) until edited by hand.
function slugFromTitle(schema: (typeof COLLECTION_SCHEMAS)[CollectionSlug]) {
  const shape = (schema as unknown as { shape?: Record<string, unknown> }).shape
  if (!shape || !("slug" in shape)) return undefined
  const from = "title" in shape ? "title" : "name" in shape ? "name" : null
  return from ? { from, to: "slug", transform: slugify } : undefined
}

// Create (item = "new") or edit, from the collection's own schema. Saves go
// live (docs/brief.md §6.3); a stale version reloads. Without update rights
// the form is read-only. Used in the drawer and on a service's own editor.
export function ItemForm({
  name,
  item,
  readOnly = false,
  onSaved,
  onCreated,
  onValuesChange,
}: {
  name: CollectionSlug
  item: EditableItem | "new"
  readOnly?: boolean
  // After a save (or a conflict reload): refresh whatever shows the item.
  onSaved(): Promise<unknown>
  // A new item's id, once created.
  onCreated?(id: string): void
  // Every edit, for a live preview beside the form.
  onValuesChange?(values: Record<string, unknown>): void
}) {
  const schema = COLLECTION_SCHEMAS[name]
  const isNew = item === "new"
  const derive = useMemo(() => slugFromTitle(schema), [schema])
  // A new item's slug follows its title; so does an existing one whose slug
  // was never picked by hand (it still equals the title's slug).
  const followsTitle =
    derive !== undefined &&
    (isNew ||
      item.values[derive.to] ===
        derive.transform(String(item.values[derive.from] ?? "")))
  const defaults = isNew
    ? { ...(emptyValueFor(schema) as Record<string, unknown>), isVisible: true }
    : item.values
  return (
    <fieldset disabled={readOnly} className="min-w-0">
      <SchemaForm
        key={isNew ? "new" : `${item.id}:${item.version}`}
        schema={schema}
        overrides={COLLECTION_FIELD_UI[name]}
        defaultValues={defaults as never}
        derive={followsTitle ? derive : undefined}
        onValuesChange={
          onValuesChange as ((values: unknown) => void) | undefined
        }
        submitLabel="Save"
        onSubmit={async (values) => {
          try {
            if (isNew) {
              const created = (await parseResponse(
                collectionsApi[":name"].$post({
                  param: { name },
                  json: { values },
                })
              )) as { id: string }
              toast.success("Saved")
              await onSaved()
              onCreated?.(created.id)
              return
            }
            await parseResponse(
              collectionsApi[":name"][":id"].$patch({
                param: { name, id: item.id },
                json: { version: item.version, values },
              })
            )
            toast.success("Saved")
            await onSaved()
          } catch (error) {
            if (conflictOf(error)) {
              await onSaved()
              toast.error(
                "Someone else changed this item. You now see their version."
              )
              return
            }
            if (error instanceof ApiError)
              return {
                formError: error.message,
                fieldErrors: error.fieldErrors,
              }
            throw error
          }
        }}
      />
    </fieldset>
  )
}

export function ItemSheet({
  name,
  item,
  readOnly = false,
  onClose,
  onSaved,
  onCreated,
}: {
  name: CollectionSlug
  item: EditableItem | "new" | null
  readOnly?: boolean
  onClose(): void
  onSaved(): Promise<unknown>
  onCreated?(id: string): void
}) {
  const isNew = item === "new"
  return (
    <Sheet open={item !== null} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
        <SheetHeader>
          <SheetTitle className="text-lg font-semibold">
            {isNew
              ? `Add ${ITEM_NOUN[name]}`
              : `${readOnly ? "View" : "Edit"} ${ITEM_NOUN[name]}`}
          </SheetTitle>
        </SheetHeader>
        {item ? (
          <div className="p-4">
            <ItemForm
              name={name}
              item={item}
              readOnly={readOnly}
              onSaved={async () => {
                await onSaved()
                onClose()
              }}
              onCreated={onCreated}
            />
          </div>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
