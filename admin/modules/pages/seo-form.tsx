"use client"

import { useState } from "react"
import { toast } from "sonner"
import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { SeoAside } from "@/admin/modules/seo/seo-aside"
import {
  SeoMetaFields,
  seoMetaDefaults,
  toSeoPatch,
} from "@/admin/modules/seo/seo-fields"

import type { PageDetail } from "./queries"

const MetaForm = z.object({
  title: z.string().trim().min(1).max(80).register(ui, {
    label: "Page title",
    description: "Used in the admin, and as the SEO title when that is empty.",
  }),
  showContactChapter: z.boolean().register(ui, {
    label: "Show the footer's Contact chapter in the journey rail",
  }),
  ...SeoMetaFields,
})
type MetaValues = z.input<typeof MetaForm>

// Live on save (docs/brief.md §6.5). Only the fields the actor may change
// are sent, so a marketer's save never trips the page.update check.
const payload = (
  v: z.output<typeof MetaForm>,
  canPage: boolean,
  canSeo: boolean
) => ({
  ...(canPage
    ? {
        title: v.title,
        settings: { showContactChapter: v.showContactChapter },
      }
    : {}),
  ...(canSeo ? { seo: toSeoPatch(v) } : {}),
})

export function SeoForm({
  page,
  onSaved,
}: {
  page: PageDetail
  onSaved(): void
}) {
  const canPage = usePermission({ page: ["update"] })
  const canSeo = usePermission({ seo: ["update"] })
  const [defaults] = useState<MetaValues>(() => ({
    title: page.title,
    showContactChapter: page.settings.showContactChapter ?? true,
    ...seoMetaDefaults(page.seo),
  }))
  const [live, setLive] = useState<MetaValues>(defaults)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section
        aria-label="Search and sharing"
        className="rounded-card bg-card p-5 sm:p-6"
      >
        <fieldset disabled={!canPage && !canSeo} className="min-w-0">
          <SchemaForm
            schema={MetaForm}
            defaultValues={defaults}
            submitLabel="Save SEO"
            onValuesChange={setLive}
            onSubmit={async (values) => {
              try {
                await parseResponse(
                  pagesApi[":id"].seo.$patch({
                    param: { id: page.id },
                    json: payload(values, canPage, canSeo),
                  })
                )
                toast.success("SEO saved")
                onSaved()
              } catch (error) {
                if (!(error instanceof ApiError)) throw error
                return {
                  formError: error.message,
                  fieldErrors: error.fieldErrors,
                }
              }
            }}
          />
        </fieldset>
      </section>
      <SeoAside path={page.path} fallbackTitle={live.title} values={live} />
    </div>
  )
}
