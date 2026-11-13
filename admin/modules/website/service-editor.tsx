"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { useCallback, useEffect, useRef, useState } from "react"
import { ArrowLeftIcon, HeartHandshakeIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { usePermission } from "@/admin/lib/actor-context"
import { queryKeys } from "@/admin/lib/query-keys"
import { ItemForm } from "@/admin/modules/collections/item-sheet"
import { collectionListQuery } from "@/admin/modules/collections/queries"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
import { pageDetailQuery, pagesListQuery } from "@/admin/modules/pages/queries"
import {
  CARD_PREVIEW_MESSAGE,
  type CardPreviewValues,
} from "@/features/services/components/service-card-preview"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

const BACK = { href: "/admin/website/services", label: "Services" }

function BackLink() {
  return (
    <Link
      href={BACK.href}
      className="inline-flex w-fit items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeftIcon aria-hidden className="size-4" />
      {BACK.label}
    </Link>
  )
}

const PREVIEW_WIDTH = 700

// The card as the site shows it, in an iframe that has the site's CSS and
// fonts. The form posts every edit to it.
function CardPreview({ values }: { values: CardPreviewValues }) {
  const frame = useRef<HTMLIFrameElement>(null)
  const latest = useRef(values)
  const box = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0.5)
  useEffect(() => {
    const el = box.current
    if (!el) return
    const fit = () => setScale(el.clientWidth / PREVIEW_WIDTH)
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage(
      { type: CARD_PREVIEW_MESSAGE, values: latest.current },
      window.location.origin
    )
  }, [])
  // The page says when it is ready for the first values.
  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return
      if (
        (event.data as { type?: string })?.type ===
        `${CARD_PREVIEW_MESSAGE}:ready`
      )
        send()
    }
    window.addEventListener("message", onMessage)
    return () => window.removeEventListener("message", onMessage)
  }, [send])
  useEffect(() => {
    latest.current = values
    send()
  }, [values, send])
  return (
    <div className="flex flex-col gap-2 xl:sticky xl:top-4">
      <p className="text-sm font-medium">Live preview</p>
      {/* Drawn at the site's desktop width (700px, the card's sm+ layout)
          and scaled to the column. */}
      <div
        ref={box}
        className="relative aspect-[700/340] w-full overflow-hidden rounded-2xl border"
      >
        <iframe
          ref={frame}
          src="/admin/embed/service-card"
          title="Card preview"
          style={{
            width: PREVIEW_WIDTH,
            height: 340,
            transform: `scale(${scale})`,
          }}
          className="absolute top-0 left-0 origin-top-left bg-transparent"
        />
      </div>
    </div>
  )
}

// The grid's "Learn more" text, from the Services page's grid section.
function useMoreLabel() {
  const list = useQuery(pagesListQuery())
  const id = list.data?.items.find((p) => p.systemKey === "services")?.id
  const detail = useQuery({
    ...pageDetailQuery(id ?? ""),
    enabled: Boolean(id),
  })
  const grid = (
    detail.data?.draft as
      { blocks?: { type: string; data: unknown }[] } | undefined
  )?.blocks?.find((b) => b.type === "services.grid")
  return (
    (grid?.data as { more?: { label?: string } } | undefined)?.more?.label ||
    "Learn more →"
  )
}

const previewOf = (
  values: Record<string, unknown>,
  moreLabel: string
): CardPreviewValues => ({
  title: String(values.title ?? ""),
  body: String(values.body ?? ""),
  icon: String(values.icon ?? ""),
  moreLabel,
})

// The service's card fields, saved to the services collection, beside a live
// preview of the card. A slug or title change moves or renames its page, so
// the page reloads too.
function ServiceCard({ serviceId }: { serviceId: string }) {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery("services"))
  const canUpdate = usePermission({ collection: ["update"] })
  const moreLabel = useMoreLabel()
  const item = list.data?.items.find((i) => i.id === serviceId)
  const [draft, setDraft] = useState<Record<string, unknown> | null>(null)
  if (list.isPending) return <CardSkeleton />
  if (!item) return <p className="text-sm">This service no longer exists.</p>
  return (
    <CardLayout preview={previewOf(draft ?? item.values, moreLabel)}>
      <ItemForm
        name="services"
        item={{ id: item.id, version: item.version, values: item.values }}
        readOnly={!canUpdate}
        onValuesChange={setDraft}
        onSaved={() =>
          Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeys.collections.list("services"),
            }),
            queryClient.invalidateQueries({ queryKey: queryKeys.pages.all }),
          ])
        }
      />
    </CardLayout>
  )
}

function CardLayout({
  preview,
  children,
}: {
  preview: CardPreviewValues
  children: React.ReactNode
}) {
  return (
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]">
      <div className="rounded-card flex min-w-0 flex-col gap-4 bg-card p-5 sm:p-6">
        <div>
          <h2 className="text-card-title">Card</h2>
          <p className="text-sm text-muted-foreground">
            What the Services grid shows for this service. The slug is its
            page&apos;s address.
          </p>
        </div>
        {children}
      </div>
      <CardPreview values={preview} />
    </div>
  )
}

export function ServiceEditor({
  serviceId,
  pageId,
  reason,
}: {
  serviceId: string
  pageId: string | null
  reason: string | null
}) {
  if (!pageId)
    return (
      <div className="flex flex-col gap-6">
        <PageHeader
          breadcrumbs={<BackLink />}
          icon={<HeartHandshakeIcon />}
          title="Edit service"
        />
        {reason ? (
          <p role="alert" className="text-sm">
            Its details page couldn&apos;t be made yet. {reason}
          </p>
        ) : null}
        <ServiceCard serviceId={serviceId} />
      </div>
    )
  return (
    <PageBuilder
      id={pageId}
      back={BACK}
      contentLabel="Details"
      card={{ label: "Card", content: <ServiceCard serviceId={serviceId} /> }}
    />
  )
}

// Adding a service: the same three tabs, with Details and SEO waiting for
// the card. Saving it makes the service and its details page, then opens
// the service's editor on its details.
export function NewServiceEditor() {
  const router = useRouter()
  const queryClient = useQueryClient()
  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        breadcrumbs={<BackLink />}
        icon={<HeartHandshakeIcon />}
        title="Add service"
      />
      <Tabs value="card" className="gap-5">
        <TabsList className="h-11 w-fit max-w-full rounded-xl bg-card p-1">
          <TabsTrigger value="card" className="rounded-lg px-5">
            Card
          </TabsTrigger>
          <TabsTrigger value="content" disabled className="rounded-lg px-5">
            Details
          </TabsTrigger>
          <TabsTrigger value="seo" disabled className="rounded-lg px-5">
            SEO
          </TabsTrigger>
        </TabsList>
        <TabsContent value="card">
          <NewServiceCard
            onCreated={(id) =>
              router.push(`/admin/website/services/${id}?tab=content`)
            }
            onSaved={() =>
              queryClient.invalidateQueries({
                queryKey: queryKeys.collections.list("services"),
              })
            }
          />
        </TabsContent>
      </Tabs>
    </div>
  )
}

function NewServiceCard({
  onCreated,
  onSaved,
}: {
  onCreated(id: string): void
  onSaved(): Promise<unknown>
}) {
  const moreLabel = useMoreLabel()
  const [draft, setDraft] = useState<Record<string, unknown>>({})
  return (
    <CardLayout preview={previewOf(draft, moreLabel)}>
      <p className="text-sm text-muted-foreground">
        Save the card first: that makes the service and its details page, and
        opens Details and SEO.
      </p>
      <ItemForm
        name="services"
        item="new"
        onValuesChange={setDraft}
        onSaved={onSaved}
        onCreated={onCreated}
      />
    </CardLayout>
  )
}
