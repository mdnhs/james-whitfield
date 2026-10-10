"use client"

import { useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"
import * as z from "zod"

import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { parseResponse, seoApi } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { queryKeys } from "@/admin/lib/query-keys"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { RedirectInput } from "@/lib/seo/redirect-rules"

import type { RedirectRow } from "./queries"

export const STATUS_LABELS: Record<number, string> = {
  301: "301 Permanent",
  302: "302 Temporary",
  307: "307 Temporary",
  308: "308 Permanent",
}

// The form works in strings (a select's values); the API takes the number.
const STATUS_OPTIONS = Object.entries(STATUS_LABELS).map(([value, label]) => ({
  value,
  label,
}))
const FormInput = RedirectInput.omit({ statusCode: true }).extend({
  statusCode: z.enum(["301", "302", "307", "308"]).default("301"),
})
const EditInput = FormInput.omit({ sourcePath: true })

const OVERRIDES = {
  sourcePath: { label: "From", placeholder: "/old-page" },
  destination: { label: "To", placeholder: "/new-page" },
  statusCode: { label: "Type", widget: "select", options: STATUS_OPTIONS },
  note: { label: "Note" },
} as const

export type Editing = RedirectRow | "new" | null

export function RedirectDialog({
  editing,
  onClose,
}: {
  editing: Editing
  onClose(): void
}) {
  const queryClient = useQueryClient()
  return (
    <Dialog open={editing !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editing === "new" ? "New redirect" : "Edit redirect"}
          </DialogTitle>
          <DialogDescription>
            Visitors and search engines who ask for the From address are sent to
            the To address.
          </DialogDescription>
        </DialogHeader>
        {editing ? (
          <>
            {editing !== "new" ? (
              <Field>
                <FieldLabel htmlFor="redirect-from">From</FieldLabel>
                <Input
                  id="redirect-from"
                  value={editing.sourcePath}
                  disabled
                  readOnly
                />
              </Field>
            ) : null}
            <SchemaForm
              schema={
                (editing === "new" ? FormInput : EditInput) as z.ZodObject
              }
              defaultValues={
                editing === "new"
                  ? {
                      sourcePath: "",
                      destination: "",
                      statusCode: "301",
                      note: "",
                    }
                  : {
                      destination: editing.destination,
                      statusCode: String(editing.statusCode),
                      note: editing.note,
                    }
              }
              overrides={OVERRIDES}
              submitLabel="Save"
              onSubmit={async (values) => {
                const v = values as z.output<typeof FormInput>
                const statusCode = Number(v.statusCode) as 301 | 302 | 307 | 308
                try {
                  const result =
                    editing === "new"
                      ? await parseResponse(
                          seoApi.redirects.$post({
                            json: {
                              sourcePath: v.sourcePath,
                              destination: v.destination,
                              statusCode,
                              note: v.note,
                            },
                          })
                        )
                      : await parseResponse(
                          seoApi.redirects[":id"].$patch({
                            param: { id: editing.id },
                            json: {
                              destination: v.destination,
                              statusCode,
                              note: v.note,
                            },
                          })
                        )
                  await queryClient.invalidateQueries({
                    queryKey: queryKeys.seo.all,
                  })
                  toast.success("Saved")
                  if (result.warning) toast.warning(result.warning)
                  onClose()
                } catch (error) {
                  if (!(error instanceof ApiError)) throw error
                  return {
                    formError: error.message,
                    fieldErrors: error.fieldErrors,
                  }
                }
              }}
            />
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  )
}
