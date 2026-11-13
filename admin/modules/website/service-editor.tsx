"use client"

import { useQuery, useQueryClient } from "@tanstack/react-query"
import { ArrowLeftIcon } from "lucide-react"
import Link from "next/link"
import { useRouter } from "next/navigation"

import { PageHeader } from "@/admin/components/dashboard/page-header"
import { CardSkeleton } from "@/admin/components/dashboard/skeletons"
import { usePermission } from "@/admin/lib/actor-context"
import { queryKeys } from "@/admin/lib/query-keys"
import { ItemForm } from "@/admin/modules/collections/item-sheet"
import { collectionListQuery } from "@/admin/modules/collections/queries"
import { PageBuilder } from "@/admin/modules/pages/page-builder"
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

// The service's card fields, saved to the services collection. A slug or
// title change moves or renames its page, so the page reloads too.
function ServiceCard({ serviceId }: { serviceId: string }) {
  const queryClient = useQueryClient()
  const list = useQuery(collectionListQuery("services"))
  const canUpdate = usePermission({ collection: ["update"] })
  const item = list.data?.items.find((i) => i.id === serviceId)
  if (list.isPending) return <CardSkeleton />
  if (!item) return <p className="text-sm">This service no longer exists.</p>
  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="text-card-title">Card</h2>
        <p className="text-sm text-muted-foreground">
          What the Services grid shows for this service. The slug is its
          page&apos;s address.
        </p>
      </div>
      <ItemForm
        name="services"
        item={{ id: item.id, version: item.version, values: item.values }}
        readOnly={!canUpdate}
        onSaved={() =>
          Promise.all([
            queryClient.invalidateQueries({
              queryKey: queryKeys.collections.list("services"),
            }),
            queryClient.invalidateQueries({ queryKey: queryKeys.pages.all }),
          ])
        }
      />
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
        <PageHeader breadcrumbs={<BackLink />} title="Edit service" />
        {reason ? (
          <p role="alert" className="text-sm">
            Its details page couldn&apos;t be made yet. {reason}
          </p>
        ) : null}
        <div className="rounded-card max-w-2xl bg-card p-5 sm:p-6">
          <ServiceCard serviceId={serviceId} />
        </div>
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
      <PageHeader breadcrumbs={<BackLink />} title="Add service" />
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
          <div className="rounded-card flex max-w-2xl flex-col gap-4 bg-card p-5 sm:p-6">
            <div>
              <h2 className="text-card-title">Card</h2>
              <p className="text-sm text-muted-foreground">
                Save the card first: that makes the service and its details
                page, and opens Details and SEO.
              </p>
            </div>
            <ItemForm
              name="services"
              item="new"
              onSaved={() =>
                queryClient.invalidateQueries({
                  queryKey: queryKeys.collections.list("services"),
                })
              }
              onCreated={(id) =>
                router.push(`/admin/website/services/${id}?tab=content`)
              }
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  )
}
