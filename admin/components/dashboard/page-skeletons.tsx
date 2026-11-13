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

// One composed skeleton per admin screen, shaped like the view it stands in
// for (PageHeader, then its controls, then the list / form / grid), so the
// content arrives without the page shifting.

type TableScreen = {
  icon?: boolean
  actions?: number
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
          <PageHeaderSkeleton icon={icon} actions={actions} />
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
    actions={2}
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
  <TableScreenSkeleton actions={1} controls={2} columns={5} rowActions={3} />
)

export const NewsletterPageSkeleton = () => (
  <TableScreenSkeleton actions={1} controls={1} columns={4} rowActions={1} />
)

export const ActivityPageSkeleton = () => (
  <TableScreenSkeleton actions={0} controls={3} columns={5} rowActions={0} />
)

export const RedirectsPageSkeleton = () => (
  <TableScreenSkeleton icon actions={1} controls={1} columns={3} />
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
  <PageSkeleton>
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

export const SeoDefaultsSkeleton = () => (
  <FormPageSkeleton fields={6} icon={false} />
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
      <FormCardSkeleton fields={5} />
      <FormCardSkeleton fields={2} />
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
  <PageSkeleton header={<PageHeaderSkeleton icon={false} actions={0} />}>
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
        <PageHeaderSkeleton icon={false} actions={0} />
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
