"use client"

import { toast } from "sonner"
import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { articlesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { MediaRef } from "@/blocks/fields"

import type { ArticleDetail } from "./queries"

const MetaForm = z.object({
  title: z.string().trim().max(70).register(ui, { label: "SEO title" }),
  description: z
    .string()
    .trim()
    .max(200)
    .register(ui, { label: "Meta description", widget: "textarea" }),
  ogImage: MediaRef.nullable(),
  noindex: z.boolean().register(ui, { label: "Hide from search engines" }),
})

const OVERRIDES = { ogImage: { label: "Social image" } }

// Live on save (docs/brief.md §6.5), like the page SEO form.
export function ArticleSeoForm({
  article,
  onSaved,
}: {
  article: ArticleDetail
  onSaved(): void
}) {
  const canSeo = usePermission({ seo: ["update"] })
  return (
    <section
      aria-label="Search and sharing"
      className="rounded-card max-w-2xl bg-card p-5 sm:p-6"
    >
      {canSeo ? null : (
        <p className="mb-4 text-sm text-muted-foreground">
          Only editors and marketers can change SEO.
        </p>
      )}
      <fieldset disabled={!canSeo} className="min-w-0">
        <SchemaForm
          schema={MetaForm}
          defaultValues={{
            title: article.seo.title ?? "",
            description: article.seo.description ?? "",
            ogImage: article.seo.ogImage ?? null,
            noindex: article.seo.noindex ?? false,
          }}
          overrides={OVERRIDES}
          submitLabel="Save SEO"
          onSubmit={async (values) => {
            try {
              await parseResponse(
                articlesApi[":id"].seo.$patch({
                  param: { id: article.id },
                  json: {
                    title: values.title || null,
                    description: values.description || null,
                    ogImage: values.ogImage,
                    noindex: values.noindex,
                  },
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
  )
}
