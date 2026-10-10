"use client"

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { toast } from "sonner"

import type { FormField } from "@/admin/components/schema-form/to-fields"
import { MediaWidget } from "@/admin/components/schema-form/widgets/media-widget"
import { usePermission } from "@/admin/lib/actor-context"
import { globalsApi, parseResponse } from "@/admin/lib/api"
import { queryKeys } from "@/admin/lib/query-keys"
import { globalQuery } from "@/admin/modules/globals/queries"
import { conflictOf } from "@/admin/modules/pages/use-autosave"
import { GLOBAL_ACCESS } from "@/lib/content/global-access"

type Ref = { mediaId: string } | null

const FIELDS: Record<"logo" | "icon", FormField> = {
  logo: {
    name: "logo",
    label: "Logo",
    widget: "media",
    required: false,
    nullable: true,
    node: {},
  },
  icon: {
    name: "icon",
    label: "Favicon",
    widget: "media",
    required: false,
    nullable: true,
    description:
      "Square PNG, JPEG or WebP, at least 512 × 512. SVG uploads are not accepted.",
    node: {},
  },
}

// The logo and favicon live in the `site` global and go live when saved
// (they are not part of the theme draft).
export function BrandAssets() {
  const queryClient = useQueryClient()
  const canUpdate = usePermission(GLOBAL_ACCESS.site.update)
  const doc = useQuery({ ...globalQuery("site"), retry: false })
  const refresh = () =>
    queryClient.invalidateQueries({
      queryKey: queryKeys.globals.detail("site"),
    })
  const save = useMutation({
    mutationFn: (patch: Partial<Record<"logo" | "icon", Ref>>) =>
      parseResponse(
        globalsApi[":key"].$put({
          param: { key: "site" },
          json: {
            version: doc.data!.version,
            value: { ...(doc.data!.value as object), ...patch },
          },
        })
      ),
    onSuccess: () => {
      toast.success("Brand images saved")
      return refresh()
    },
    onError: (error) => {
      if (conflictOf(error)) {
        toast.error("Changed by someone else")
        return refresh()
      }
      toast.error(error.message)
    },
  })
  if (!doc.data) return null
  const value = doc.data.value as unknown as Record<string, Ref | undefined>
  return (
    <section
      aria-label="Brand images"
      className="rounded-card flex flex-col gap-4 bg-card p-5"
    >
      <h2 className="text-card-title">Brand images</h2>
      <fieldset
        disabled={!canUpdate || save.isPending}
        className="flex min-w-0 flex-col gap-5"
      >
        {(["logo", "icon"] as const).map((key) => (
          <MediaWidget
            key={`${key}-${doc.data.version}`}
            field={FIELDS[key]}
            value={value[key] ?? null}
            onChange={(next) => save.mutate({ [key]: next })}
          />
        ))}
      </fieldset>
    </section>
  )
}
