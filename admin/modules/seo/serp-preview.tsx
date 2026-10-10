// "host › segment" as a search result prints it.
export function serpUrl(host: string, path: string) {
  return [host, ...path.split("/").filter(Boolean)].join(" › ")
}

export function SerpPreview({
  url,
  title,
  description,
}: {
  url: string
  title: string
  description: string
}) {
  return (
    <div className="rounded-xl border bg-background p-4">
      <p className="truncate font-mono text-xs text-muted-foreground">{url}</p>
      <p className="mt-1 line-clamp-1 text-lg leading-snug font-medium text-[#1a0dab] dark:text-[#8ab4f8]">
        {title}
      </p>
      <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
        {description || "No description yet."}
      </p>
    </div>
  )
}
