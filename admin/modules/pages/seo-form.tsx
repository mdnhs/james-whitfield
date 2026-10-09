"use client"

import { CircleAlertIcon, CircleCheckIcon } from "lucide-react"
import { toast } from "sonner"
import * as z from "zod"

import { ui } from "@/admin/components/schema-form/registry"
import { SchemaForm } from "@/admin/components/schema-form/schema-form"
import { usePermission } from "@/admin/lib/actor-context"
import { pagesApi, parseResponse } from "@/admin/lib/api"
import { ApiError } from "@/admin/lib/api-error"
import { MediaRef } from "@/blocks/fields"
import { cn } from "@/lib/utils"

import type { PageDetail } from "./queries"

const MetaForm = z.object({
  title: z.string().trim().min(1).max(80).register(ui, {
    label: "Page title",
    description: "Used in the admin, and as the SEO title when that is empty.",
  }),
  seoTitle: z.string().trim().max(70).register(ui, { label: "SEO title" }),
  description: z
    .string()
    .trim()
    .max(200)
    .register(ui, { label: "Meta description", widget: "textarea" }),
  ogImage: MediaRef.nullable(),
  noindex: z.boolean().register(ui, { label: "Hide from search engines" }),
  showContactChapter: z.boolean().register(ui, {
    label: "Show the footer's Contact chapter in the journey rail",
  }),
})

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
  ...(canSeo
    ? {
        seo: {
          title: v.seoTitle || null,
          description: v.description || null,
          ogImage: v.ogImage,
          noindex: v.noindex,
        },
      }
    : {}),
})

const OVERRIDES = { ogImage: { label: "Social share image" } }

function Check({ ok, children }: { ok: boolean; children: React.ReactNode }) {
  const Icon = ok ? CircleCheckIcon : CircleAlertIcon
  return (
    <li className="flex items-start gap-2.5 text-sm">
      <Icon
        aria-hidden
        className={cn(
          "mt-0.5 size-4 shrink-0",
          ok ? "text-success" : "text-warning"
        )}
      />
      <span>
        <span className="sr-only">{ok ? "Passed: " : "Needs work: "}</span>
        {children}
      </span>
    </li>
  )
}

export function SeoForm({
  page,
  onSaved,
}: {
  page: PageDetail
  onSaved(): void
}) {
  const canPage = usePermission({ page: ["update"] })
  const canSeo = usePermission({ seo: ["update"] })
  const title = page.seo.title || page.title
  const description = page.seo.description ?? ""
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,0.85fr)]">
      <section
        aria-label="Search and sharing"
        className="rounded-card bg-card p-5 sm:p-6"
      >
        <fieldset disabled={!canPage && !canSeo} className="min-w-0">
          <SchemaForm
            schema={MetaForm}
            defaultValues={{
              title: page.title,
              seoTitle: page.seo.title ?? "",
              description: page.seo.description ?? "",
              ogImage: page.seo.ogImage ?? null,
              noindex: page.seo.noindex ?? false,
              showContactChapter: page.settings.showContactChapter ?? true,
            }}
            overrides={OVERRIDES}
            submitLabel="Save SEO"
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
      <aside className="flex flex-col gap-6 lg:sticky lg:top-4 lg:self-start">
        <section
          aria-labelledby="serp-heading"
          className="rounded-card flex flex-col gap-4 bg-card p-5 sm:p-6"
        >
          <h2 id="serp-heading" className="text-card-title">
            In search results
          </h2>
          <div className="rounded-xl border bg-background p-4">
            <p className="truncate font-mono text-xs text-muted-foreground">
              {page.path}
            </p>
            <p className="mt-1 line-clamp-1 text-lg leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
              {title}
            </p>
            <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
              {description || "No description yet."}
            </p>
          </div>
          <ul className="flex flex-col gap-2.5" aria-label="Checks">
            <Check ok={title.length >= 15 && title.length <= 60}>
              Title is {title.length} characters (15–60 reads best)
            </Check>
            <Check ok={description.length >= 50}>
              {description
                ? `Description is ${description.length} characters (aim for 50–160)`
                : "Add a meta description"}
            </Check>
            <Check ok={page.seo.ogImage !== null}>
              {page.seo.ogImage
                ? "Has a social share image"
                : "No social share image; the site default is used"}
            </Check>
            <Check ok={!page.seo.noindex}>
              {page.seo.noindex
                ? "Hidden from search engines"
                : "Visible to search engines"}
            </Check>
          </ul>
          <p className="text-xs text-muted-foreground">
            Shows what is saved. SEO changes go live when you save them.
          </p>
        </section>
      </aside>
    </div>
  )
}
