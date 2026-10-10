"use client"

import { useQuery } from "@tanstack/react-query"
import { useState } from "react"
import { toast } from "sonner"

import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { articlesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { SeoAside } from "@/admin/modules/seo/seo-aside"
import {
  SeoMetaForm,
  seoMetaDefaults,
  toSeoPatch,
  type SeoMetaValues,
} from "@/admin/modules/seo/seo-fields"
import type { ArticleDraft } from "@/lib/content/article"

import { categoriesQuery, type ArticleDetail } from "./queries"

// Live on save (docs/brief.md §6.5), like the page SEO form. The preview
// follows the working draft's title, slug and excerpt as well as the fields.
export function ArticleSeoForm({
  article,
  draft,
  onSaved,
}: {
  article: ArticleDetail
  draft: ArticleDraft
  onSaved(): void
}) {
  const canSeo = usePermission({ seo: ["update"] })
  const [defaults] = useState<SeoMetaValues>(() => seoMetaDefaults(article.seo))
  const categories = useQuery(categoriesQuery())
  const category = categories.data?.items.find(
    (item) => item.id === draft.categoryId
  )
  const [live, setLive] = useState<SeoMetaValues>(defaults)
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section
        aria-label="Search and sharing"
        className="rounded-card bg-card p-5 sm:p-6"
      >
        {canSeo ? null : (
          <p className="mb-4 text-sm text-muted-foreground">
            Only editors and marketers can change SEO.
          </p>
        )}
        <fieldset disabled={!canSeo} className="min-w-0">
          <SchemaForm
            schema={SeoMetaForm}
            defaultValues={defaults}
            submitLabel="Save SEO"
            onValuesChange={setLive}
            onSubmit={async (values) => {
              try {
                await parseResponse(
                  articlesApi[":id"].seo.$patch({
                    param: { id: article.id },
                    json: toSeoPatch(values),
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
      <SeoAside
        path={`/insights/${draft.slug}`}
        fallbackTitle={draft.title}
        summary={draft.excerpt}
        eyebrow={category?.name}
        values={live}
      />
    </div>
  )
}
