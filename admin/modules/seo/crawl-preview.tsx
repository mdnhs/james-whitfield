"use client"

import { useQuery } from "@tanstack/react-query"

import { DashboardCard } from "@/admin/components/dashboard/dashboard-card"
import { Skeleton } from "@/components/ui/skeleton"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

async function fetchText(path: string) {
  const res = await fetch(path)
  if (!res.ok) throw new Error(`${path} answered ${res.status}`)
  return res.text()
}

const locs = (xml: string) =>
  [...xml.matchAll(/<loc>([^<]*)<\/loc>/g)].map((m) => m[1]!)

const OPEN =
  "text-sm font-semibold text-primary underline-offset-4 hover:underline"

function Pane({
  path,
  label,
  children,
}: {
  path: string
  label: string
  children: (text: string) => React.ReactNode
}) {
  const query = useQuery({
    queryKey: ["seo", "crawl", path],
    queryFn: () => fetchText(path),
  })
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">{label}</p>
        <a href={path} target="_blank" rel="noreferrer" className={OPEN}>
          Open
          <span className="sr-only"> {path} in a new tab</span>
        </a>
      </div>
      {query.isPending ? (
        <Skeleton className="h-32 w-full" />
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : (
        children(query.data)
      )}
    </div>
  )
}

export function CrawlPreview() {
  return (
    <DashboardCard title="What crawlers see">
      <Tabs defaultValue="robots">
        <TabsList>
          <TabsTrigger value="robots">robots.txt</TabsTrigger>
          <TabsTrigger value="sitemap">Sitemap</TabsTrigger>
        </TabsList>
        <TabsContent value="robots" className="pt-3">
          <Pane path="/robots.txt" label="What search engines may crawl.">
            {(text) => (
              <pre className="max-h-80 overflow-auto rounded-lg bg-muted p-4 font-mono text-xs whitespace-pre-wrap">
                {text}
              </pre>
            )}
          </Pane>
        </TabsContent>
        <TabsContent value="sitemap" className="pt-3">
          <Pane
            path="/sitemap.xml"
            label="Addresses offered to search engines."
          >
            {(xml) => {
              const urls = locs(xml)
              return (
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-semibold">
                    {urls.length} {urls.length === 1 ? "address" : "addresses"}
                  </p>
                  <ul className="flex max-h-80 flex-col gap-1 overflow-auto font-mono text-xs break-all">
                    {urls.slice(0, 20).map((url) => (
                      <li key={url}>{url}</li>
                    ))}
                  </ul>
                  {urls.length > 20 ? (
                    <p className="text-xs text-muted-foreground">
                      and {urls.length - 20} more
                    </p>
                  ) : null}
                </div>
              )
            }}
          </Pane>
        </TabsContent>
      </Tabs>
      <p className="text-sm text-muted-foreground">
        Outside production, robots.txt blocks every crawler.
      </p>
    </DashboardCard>
  )
}
