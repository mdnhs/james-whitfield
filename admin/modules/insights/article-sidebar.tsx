"use client"

import { useQuery } from "@tanstack/react-query"
import { useId } from "react"

import { MediaWidget } from "@/admin/components/schema-form/widgets/media-widget"
import type { FormField } from "@/admin/components/schema-form/to-fields"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldLabel,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { Textarea } from "@/components/ui/textarea"
import type { ArticleDraft } from "@/lib/content/article"
import { plainText, readingMinutes } from "@/lib/content/reading-time"

import { authorsQuery, categoriesQuery, type ArticleDetail } from "./queries"
import { formatDublin } from "./schedule-time"

export const EXCERPT_MAX = 240

// The widget labels itself from the field; this one doubles as the name of
// its trigger button.
const COVER_FIELD: FormField = {
  name: "cover",
  label: "Choose cover image",
  widget: "media",
  required: true,
  nullable: true,
  node: {},
}

export type FieldErrors = Record<string, string[]>

// Publish reports dotted paths ("cover.mediaId"); a field shows its own and
// anything beneath it.
const errorOf = (errors: FieldErrors, name: string) =>
  Object.entries(errors).find(
    ([key]) => key === name || key.startsWith(`${name}.`)
  )?.[1]?.[0]

export function ArticleSidebar({
  draft,
  patch,
  errors,
  article,
  canPublish,
}: {
  draft: ArticleDraft
  patch(change: Partial<ArticleDraft>): void
  errors: FieldErrors
  article: ArticleDetail
  canPublish: boolean
}) {
  const id = useId()
  const categories = useQuery(categoriesQuery())
  const authors = useQuery(authorsQuery())
  const categoryItems = (categories.data?.items ?? []).map((c) => ({
    value: c.id,
    label: c.name,
  }))
  const authorItems = (authors.data?.items ?? []).map((a) => ({
    value: a.id,
    label: a.name,
  }))
  const minutes = readingMinutes(plainText(draft.body))
  const slugError = errorOf(errors, "slug")
  const excerptError = errorOf(errors, "excerpt")
  const coverError = errorOf(errors, "cover")
  return (
    <div className="flex flex-col gap-5">
      <Field data-invalid={slugError ? true : undefined}>
        <FieldLabel htmlFor={`${id}-slug`}>Slug</FieldLabel>
        <Input
          id={`${id}-slug`}
          value={draft.slug}
          maxLength={80}
          aria-invalid={slugError ? true : undefined}
          onChange={(event) => patch({ slug: event.target.value })}
        />
        {article.publishedAt ? (
          <FieldDescription>
            Changing the slug of a published article adds a redirect from the
            old address.
          </FieldDescription>
        ) : null}
        {slugError ? <FieldError>{slugError}</FieldError> : null}
      </Field>
      <Field data-invalid={excerptError ? true : undefined}>
        <FieldLabel htmlFor={`${id}-excerpt`}>Excerpt</FieldLabel>
        <Textarea
          id={`${id}-excerpt`}
          value={draft.excerpt}
          rows={4}
          aria-invalid={excerptError ? true : undefined}
          onChange={(event) => patch({ excerpt: event.target.value })}
        />
        <p
          className={
            draft.excerpt.length > EXCERPT_MAX
              ? "text-xs text-destructive tabular-nums"
              : "text-xs text-muted-foreground tabular-nums"
          }
        >
          {draft.excerpt.length}/{EXCERPT_MAX}
        </p>
        {excerptError ? <FieldError>{excerptError}</FieldError> : null}
      </Field>
      <MediaWidget
        field={COVER_FIELD}
        value={draft.cover}
        onChange={(cover) => patch({ cover })}
        error={coverError}
      />
      <Field data-invalid={errorOf(errors, "categoryId") ? true : undefined}>
        <FieldLabel htmlFor={`${id}-category`}>Category</FieldLabel>
        <Select
          items={categoryItems}
          value={draft.categoryId}
          onValueChange={(value) => patch({ categoryId: String(value) })}
        >
          <SelectTrigger id={`${id}-category`} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {categoryItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorOf(errors, "categoryId") ? (
          <FieldError>{errorOf(errors, "categoryId")}</FieldError>
        ) : null}
      </Field>
      <Field data-invalid={errorOf(errors, "authorId") ? true : undefined}>
        <FieldLabel htmlFor={`${id}-author`}>Author</FieldLabel>
        <Select
          items={authorItems}
          value={draft.authorId}
          disabled={!canPublish}
          onValueChange={(value) => patch({ authorId: String(value) })}
        >
          <SelectTrigger id={`${id}-author`} className="w-full">
            <SelectValue placeholder="Choose…" />
          </SelectTrigger>
          <SelectContent>
            {authorItems.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errorOf(errors, "authorId") ? (
          <FieldError>{errorOf(errors, "authorId")}</FieldError>
        ) : null}
      </Field>
      <Field orientation="horizontal">
        <Switch
          id={`${id}-featured`}
          checked={draft.featured}
          onCheckedChange={(featured) => patch({ featured })}
        />
        <div className="flex flex-col gap-1">
          <FieldLabel htmlFor={`${id}-featured`}>Featured article</FieldLabel>
          <FieldDescription>
            Only one article is featured; publishing this one unfeatures the
            other.
          </FieldDescription>
        </div>
      </Field>
      <dl className="flex flex-col gap-2 border-t pt-4 text-sm">
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Published on</dt>
          <dd>
            {article.publishedAt
              ? formatDublin(article.publishedAt)
              : "Not yet"}
          </dd>
        </div>
        {article.status === "scheduled" && article.scheduledFor ? (
          <div className="flex justify-between gap-3">
            <dt className="text-muted-foreground">Scheduled for</dt>
            <dd>{formatDublin(article.scheduledFor)}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-3">
          <dt className="text-muted-foreground">Reading time</dt>
          <dd>{minutes} min</dd>
        </div>
      </dl>
    </div>
  )
}
