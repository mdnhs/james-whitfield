"use client"

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

import { COLLECTION_FIELD_UI, ITEM_NOUN } from "./collection-ui"

export type EditableItem = {
  id: string
  version: number
  values: Record<string, unknown>
}

// Create (item = "new") or edit, from the collection's own schema. Saves go
// live (docs/brief.md §6.3); a stale version reloads the list. Without
// update rights the form is read-only.
export function ItemSheet({
  name,
  item,
  readOnly = false,
  onClose,
  onSaved,
}: {
  name: CollectionSlug
  item: EditableItem | "new" | null
  readOnly?: boolean
  onClose(): void
  onSaved(): Promise<unknown>
}) {
  const schema = COLLECTION_SCHEMAS[name]
  const isNew = item === "new"
  const defaults = isNew
    ? { ...(emptyValueFor(schema) as Record<string, unknown>), isVisible: true }
    : item?.values
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
        {defaults ? (
          <fieldset disabled={readOnly} className="min-w-0 p-4">
            <SchemaForm
              key={isNew ? "new" : `${item!.id}:${item!.version}`}
              schema={schema}
              overrides={COLLECTION_FIELD_UI[name]}
              defaultValues={defaults as never}
              submitLabel="Save"
              onSubmit={async (values) => {
                try {
                  if (isNew)
                    await parseResponse(
                      collectionsApi[":name"].$post({
                        param: { name },
                        json: { values },
                      })
                    )
                  else
                    await parseResponse(
                      collectionsApi[":name"][":id"].$patch({
                        param: { name, id: item!.id },
                        json: { version: item!.version, values },
                      })
                    )
                  toast.success("Saved")
                  await onSaved()
                  onClose()
                } catch (error) {
                  if (conflictOf(error)) {
                    await onSaved()
                    onClose()
                    toast.error(
                      "Someone else changed this item. The list now shows their version."
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
        ) : null}
      </SheetContent>
    </Sheet>
  )
}
