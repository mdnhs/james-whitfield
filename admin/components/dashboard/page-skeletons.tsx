import {
  EditorLayoutSkeleton,
  FormCardSkeleton,
  ListRowsSkeleton,
  MediaGridSkeleton,
  PageHeaderSkeleton,
  PageSkeleton,
  SegmentedSkeleton,
  TabBarSkeleton,
  TableSkeleton,
  ToolbarSkeleton,
  TwoPaneSkeleton,
} from "@/admin/components/dashboard/skeletons"
import { Skeleton } from "@/components/ui/skeleton"

// One composed skeleton per admin screen, shaped like the view it stands in
// for (PageHeader, then its controls, then the list / form / grid), so the
// content arrives without the page shifting.

type TableScreen = {
  icon?: boolean
  actions?: number
  iconActions?: boolean
  controls?: number
  search?: boolean
  rows?: number
  columns?: number
  rowActions?: number
  insightsTabs?: boolean
  segmented?: boolean
}

export function TableScreenSkeleton({
  icon = false,
  actions = 1,
  iconActions = false,
  controls = 1,
  search = true,
  rows = 6,
  columns = 4,
  rowActions = 2,
  insightsTabs = false,
  segmented = false,
}: TableScreen) {
  return (
    <PageSkeleton
      header={
        <>
          {insightsTabs ? <TabBarSkeleton /> : null}
          <PageHeaderSkeleton
            icon={icon}
            actions={actions}
            iconActions={iconActions}
          />
          {segmented ? <SegmentedSkeleton /> : null}
          {controls > 0 || search ? (
            <ToolbarSkeleton controls={controls} search={search} />
          ) : null}
        </>
      }
    >
      <TableSkeleton rows={rows} columns={columns} actions={rowActions} />
    </PageSkeleton>
  )
}

export const LeadsPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={2}
    iconActions
    segmented
    controls={2}
    search
    columns={5}
    rowActions={1}
  />
)

export const ArticlesPageSkeleton = () => (
  <TableScreenSkeleton insightsTabs icon controls={3} columns={5} />
)

export const TaxonomyPageSkeleton = () => (
  <TableScreenSkeleton
    insightsTabs
    icon
    search={false}
    controls={0}
    columns={3}
  />
)

export const ArticleEditorSkeleton = () => <EditorLayoutSkeleton columns={2} />

export const PageBuilderSkeleton = () => <EditorLayoutSkeleton columns={3} />

export const PagesListSkeleton = () => (
  <TableScreenSkeleton actions={0} search={false} controls={0} columns={4} />
)

export const UsersPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={1}
    segmented
    controls={2}
    columns={5}
    rowActions={3}
  />
)

export const NewsletterPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={1}
    iconActions
    controls={1}
    columns={4}
    rowActions={1}
  />
)

export const ActivityPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={1}
    iconActions
    controls={3}
    columns={5}
    rowActions={1}
  />
)

export const RedirectsPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={1}
    controls={1}
    columns={3}
    rowActions={3}
  />
)

export const EventsPageSkeleton = () => (
  <TableScreenSkeleton
    icon
    actions={0}
    search={false}
    controls={0}
    columns={4}
    rowActions={0}
  />
)

export const CollectionPageSkeleton = () => (
  <TableScreenSkeleton icon actions={1} search={false} controls={0} />
)

export const ChatPageSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <TwoPaneSkeleton />
  </PageSkeleton>
)

export const MediaPageSkeleton = () => (
  <PageSkeleton
    header={
      <>
        <PageHeaderSkeleton icon actions={0} />
        <div className="rounded-xl border border-dashed p-6">
          <div className="bg-skeleton mx-auto h-10 w-56 rounded-md" />
        </div>
        <ToolbarSkeleton controls={2} />
      </>
    }
  >
    <MediaGridSkeleton />
  </PageSkeleton>
)

// Settings-style screens: a header and one SchemaForm card.
export const FormPageSkeleton = ({
  fields = 5,
  icon = true,
}: {
  fields?: number
  icon?: boolean
}) => (
  <PageSkeleton header={<PageHeaderSkeleton icon={icon} actions={0} />}>
    <FormCardSkeleton fields={fields} title={false} />
  </PageSkeleton>
)

// The SEO defaults card, then What crawlers see.
export const SeoDefaultsSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <FormCardSkeleton fields={6} title={false} />
    <FormCardSkeleton fields={2} />
  </PageSkeleton>
)

export const GlobalEditorPageSkeleton = () => <FormPageSkeleton fields={6} />

// The AI assistant form: the on/off row, then Provider, Access and Answers.
export const AiSettingsCardsSkeleton = () => (
  <div aria-hidden className="flex max-w-3xl flex-col gap-6">
    <div className="rounded-card bg-card p-5 sm:px-6">
      <div className="bg-skeleton h-6 w-56 rounded-md" />
    </div>
    <FormCardSkeleton fields={3} />
    <FormCardSkeleton fields={2} />
    <FormCardSkeleton fields={2} />
  </div>
)

export const AiSettingsPageSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <AiSettingsCardsSkeleton />
  </PageSkeleton>
)

export const ServiceEditorSkeleton = () => (
  <div
    aria-hidden
    className="grid items-start gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,24rem)]"
  >
    <PageSkeleton
      header={
        <>
          <PageHeaderSkeleton icon actions={1} />
          <SegmentedSkeleton />
        </>
      }
    >
      <FormCardSkeleton fields={5} title={false} />
    </PageSkeleton>
    <FormCardSkeleton fields={3} title />
  </div>
)

export const TrackingPageSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <div className="grid items-start gap-8 xl:grid-cols-[minmax(0,1fr)_22rem]">
      <FormCardSkeleton fields={5} title={false} />
      <div className="flex flex-col gap-6">
        <FormCardSkeleton fields={4} />
        <FormCardSkeleton fields={1} />
      </div>
    </div>
  </PageSkeleton>
)

export const ConsentPageSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <div className="grid items-start gap-8 lg:grid-cols-2">
      <FormCardSkeleton fields={4} />
      <FormCardSkeleton fields={4} />
    </div>
  </PageSkeleton>
)

export const CodePageSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <FormCardSkeleton fields={3} title={false} />
  </PageSkeleton>
)

export const SeoOverviewSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={0} />}>
    <div className="grid gap-6 lg:grid-cols-2">
      <FormCardSkeleton fields={2} />
      <FormCardSkeleton fields={2} />
    </div>
    <div className="rounded-card bg-card p-5 sm:p-6">
      <ListRowsSkeleton rows={3} rowClassName="h-12" />
    </div>
  </PageSkeleton>
)

export const AccountPageSkeleton = () => (
  <PageSkeleton
    header={
      <>
        <PageHeaderSkeleton icon actions={0} />
        <SegmentedSkeleton count={3} />
      </>
    }
  >
    <div className="grid gap-4 xl:grid-cols-2">
      <FormCardSkeleton fields={3} />
      <FormCardSkeleton fields={1} />
    </div>
  </PageSkeleton>
)

export const AppearancePageSkeleton = () => (
  <PageSkeleton
    header={
      <>
        <PageHeaderSkeleton icon actions={1} />
        <SegmentedSkeleton count={2} />
      </>
    }
  >
    <div className="grid gap-5 xl:grid-cols-2">
      <FormCardSkeleton fields={4} />
      <FormCardSkeleton fields={4} />
    </div>
  </PageSkeleton>
)

export const LegalPagesSkeleton = () => (
  <PageSkeleton header={<PageHeaderSkeleton icon actions={1} />}>
    <TableSkeleton rows={4} columns={2} actions={2} />
  </PageSkeleton>
)

// /admin/help: the topics column (help/layout.tsx) around the article.
export const HelpPageSkeleton = () => (
  <div
    aria-hidden
    aria-busy
    className="grid gap-8 lg:grid-cols-[17rem_minmax(0,1fr)]"
  >
    <div className="hidden flex-col gap-2 lg:flex">
      {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map((i) => (
        <Skeleton key={i} className="bg-skeleton h-7 rounded-lg" />
      ))}
    </div>
    <div className="flex min-w-0 flex-col gap-6">
      <Skeleton className="bg-skeleton h-10 w-36 rounded-xl lg:hidden" />
      <HelpArticleSkeleton />
    </div>
  </div>
)

// One article (breadcrumb, title, lead, sections) and, on wide screens,
// "On this page": the page's own fallback while the topics column stays.
export const HelpArticleSkeleton = () => (
  <div
    aria-hidden
    aria-busy
    className="grid gap-8 xl:grid-cols-[minmax(0,1fr)_14rem]"
  >
    <div className="flex max-w-[70ch] flex-col gap-4">
      <Skeleton className="bg-skeleton h-4 w-48 rounded-md" />
      <Skeleton className="bg-skeleton h-9 w-2/3 rounded-lg" />
      <Skeleton className="bg-skeleton h-16 w-full rounded-lg" />
      {[0, 1].map((i) => (
        <div key={i} className="mt-6 flex flex-col gap-3">
          <Skeleton className="bg-skeleton h-6 w-1/3 rounded-md" />
          <Skeleton className="bg-skeleton h-4 w-full rounded-md" />
          <Skeleton className="bg-skeleton h-4 w-5/6 rounded-md" />
          <Skeleton className="bg-skeleton h-4 w-4/6 rounded-md" />
        </div>
      ))}
    </div>
    <div className="hidden flex-col gap-2 xl:flex">
      {[0, 1, 2, 3, 4].map((i) => (
        <Skeleton key={i} className="bg-skeleton h-5 rounded-md" />
      ))}
    </div>
  </div>
)
